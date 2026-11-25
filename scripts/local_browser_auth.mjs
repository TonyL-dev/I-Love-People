// Live synthetic journey. Credentials arrive on stdin; no traces, video, or credential screenshots.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

const fixture = JSON.parse(readFileSync(0, 'utf8'));
let stage = 'browser-start';
let browser;
const diagnostics = {
  navigation: false,
  loginStatus: 0,
  profileStatus: 0,
  pageError: false,
  nudgeStep: 0,
};
try {
  browser = await chromium.launch({
    ...(process.env.ILP_BROWSER_EXECUTABLE
      ? { executablePath: process.env.ILP_BROWSER_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on('pageerror', () => {
    diagnostics.pageError = true;
  });
  page.on('response', (response) => {
    if (response.url().includes('/auth/v1/token?')) diagnostics.loginStatus = response.status();
    if (response.url().endsWith('/api/profile')) diagnostics.profileStatus = response.status();
  });
  async function login(password) {
    await page.getByLabel('Email', { exact: true }).fill(fixture.email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Your private space.' }).waitFor();
  }
  async function capturedLink(matches) {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const listing = await (
        await context.request.get('http://127.0.0.1:54324/api/v1/messages?limit=1000')
      ).json();
      for (const message of listing.messages) {
        if (!message.To.some((recipient) => recipient.Address === fixture.email)) continue;
        const detail = await (
          await context.request.get('http://127.0.0.1:54324/api/v1/message/' + message.ID)
        ).json();
        for (const match of detail.HTML.matchAll(/href="([^"]+)"/g)) {
          const url = new URL(match[1].replaceAll('&amp;', '&'));
          if (matches(url)) return url.href;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Captured Auth email link was not found');
  }
  async function openAccountMenu() {
    const menu = page.getByRole('dialog', { name: 'Settings and account' });
    if (!(await menu.isVisible()))
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
    return menu;
  }
  async function closeAccountMenu() {
    await page
      .getByRole('dialog', { name: 'Settings and account' })
      .getByRole('button', { name: 'Close', exact: true })
      .click();
  }
  async function logout() {
    await openAccountMenu();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm sign out' }).click();
    await page.getByRole('heading', { name: 'Keep your people close.' }).waitFor();
  }
  stage = 'navigation';
  await page.goto('http://127.0.0.1:5173/');
  diagnostics.navigation = true;
  stage = 'managed-signup';
  await page.getByRole('link', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(fixture.email);
  await page.getByLabel('Password', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Check your email.', { exact: true })).toBeVisible();
  assert.equal((await context.request.get('http://127.0.0.1:8000/api/people')).status(), 401);
  stage = 'captured-confirmation-email';
  const confirmation = await capturedLink(
    (url) =>
      url.origin === 'http://127.0.0.1:5173' &&
      url.pathname === '/confirm-email' &&
      url.hash.startsWith('#token_hash='),
  );
  await page.goto(confirmation);
  assert.equal(new URL(page.url()).hash, '');
  await page.getByRole('button', { name: 'Confirm email' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Email confirmed. Sign in to open your library.' }),
  ).toBeVisible();
  await page.goto(confirmation);
  await page.getByRole('button', { name: 'Confirm email' }).click();
  await expect(page.getByRole('alert')).toContainText('invalid, expired, or already used');
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  stage = 'managed-login';
  await login(fixture.password);
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await expect(page.getByText('No people yet.', { exact: false })).toBeVisible();
  stage = 'owned-preference';
  await openAccountMenu();
  await page.getByRole('searchbox', { name: 'Search timezones' }).fill('Toronto');
  await page.getByLabel('Timezone', { exact: true }).selectOption('America/Toronto');
  await page.getByRole('button', { name: 'Save timezone' }).click();
  await page.getByText('Timezone saved.', { exact: true }).waitFor();
  await closeAccountMenu();
  stage = 'people-and-meetup-persistence';
  await page.getByRole('button', { name: 'Add person', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('Synthetic Maya');
  await dialog.getByLabel('Private priority').selectOption('closest');
  await dialog.getByRole('button', { name: 'Use suggested cadence: every 2 weeks' }).click();
  await dialog.getByRole('button', { name: 'Save person', exact: true }).click();
  await page.getByRole('button', { name: 'Synthetic Maya', exact: true }).click();
  await page.getByRole('button', { name: 'Log meetup', exact: true }).click();
  await dialog.getByLabel('Meetup date').fill('2020-02-29');
  await dialog.getByLabel('Note (optional)').fill('Synthetic walk');
  await dialog.getByRole('button', { name: 'Save meetup', exact: true }).click();
  await expect(page.getByText('Synthetic walk', { exact: true })).toBeVisible();
  stage = 'due-nudges';
  await page.getByRole('button', { name: 'Catch up', exact: true }).click();
  diagnostics.nudgeStep = 1;
  const dueGroup = page.getByRole('region', { name: 'Time to catch up', exact: true });
  await expect(dueGroup).toContainText('Synthetic Maya');
  diagnostics.nudgeStep = 2;
  await page.getByRole('button', { name: 'More about Synthetic Maya', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic Maya', exact: true })).toBeFocused();
  await page.getByLabel('Snooze until', { exact: true }).fill('2099-01-01');
  await page.getByRole('button', { name: 'Snooze nudge', exact: true }).click();
  diagnostics.nudgeStep = 3;
  await expect(
    page.getByRole('status').filter({ hasText: 'Nudge snoozed until 2099-01-01.' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Nudge preferences' })).toContainText(
    'Catch-up date: 2020-03-14',
  );
  diagnostics.nudgeStep = 4;
  await page.getByRole('button', { name: 'Back to Catch up', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Taking a pause', exact: true })).toContainText(
    'Snoozed until 2099-01-01',
  );
  await page.getByRole('button', { name: 'Weekly review', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Weekly review', exact: true })).toContainText(
    'Last meetup 2020-02-29; every 2 weeks; catch-up date 2020-03-14',
  );
  diagnostics.nudgeStep = 5;
  await page.getByRole('button', { name: 'More about Synthetic Maya', exact: true }).click();
  await page.getByRole('button', { name: 'Pause nudges', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unpause nudges', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Nudges paused.' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Weekly review', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Weekly review', exact: true })).not.toContainText(
    'Synthetic Maya',
  );
  diagnostics.nudgeStep = 6;
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Synthetic Maya', exact: true }).click();
  await page.getByRole('button', { name: 'Unpause nudges', exact: true }).click();
  diagnostics.nudgeStep = 7;
  await page.getByRole('button', { name: 'Dismiss for today', exact: true }).click();
  diagnostics.nudgeStep = 72;
  await expect(page.getByRole('button', { name: 'Show again today', exact: true })).toBeVisible();
  diagnostics.nudgeStep = 73;
  await page.getByRole('button', { name: 'Log meetup', exact: true }).click();
  diagnostics.nudgeStep = 74;
  await dialog.getByLabel('Meetup date').fill('2020-03-31');
  diagnostics.nudgeStep = 75;
  await dialog.getByRole('button', { name: 'Save meetup', exact: true }).click();
  diagnostics.nudgeStep = 8;
  await expect(page.getByRole('button', { name: 'Clear snooze', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show again today', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Catch up', exact: true }).click();
  await expect(dueGroup).toContainText('Synthetic Maya');
  diagnostics.nudgeStep = 9;
  mkdirSync('artifacts/local', { recursive: true });
  for (const appearance of ['light', 'dark']) {
    await openAccountMenu();
    await page.getByLabel('Appearance', { exact: true }).selectOption(appearance);
    await closeAccountMenu();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
        ),
      );
      const audit = await new AxeBuilder({ page }).analyze();
      assert.equal(audit.violations.length, 0);
      await page.screenshot({
        path: `artifacts/local/phase3-catchup-${appearance}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.getByRole('button', { name: 'Weekly review', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => {
    globalThis.document.documentElement.style.fontSize = '200%';
  });
  assert(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  );
  assert.equal((await new AxeBuilder({ page }).analyze()).violations.length, 0);
  await page.screenshot({ path: 'artifacts/local/phase3-review-large-text.png', fullPage: true });
  await page.evaluate(() => {
    globalThis.document.documentElement.style.fontSize = '';
  });
  await page.getByRole('button', { name: 'More about Synthetic Maya', exact: true }).click();
  await page.getByRole('button', { name: 'Log meetup', exact: true }).click();
  await page.screenshot({ path: 'artifacts/local/phase3-meetup-dialog.png', fullPage: true });
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  const stored = await page.evaluate(() =>
    JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
  );
  assert(
    !stored.includes('access_token') &&
      !stored.includes('refresh_token') &&
      !stored.includes(fixture.password),
  );
  stage = 'reload-and-logout';
  await page.reload();
  await page.getByRole('heading', { name: 'Keep your people close.' }).waitFor();
  await login(fixture.password);
  await openAccountMenu();
  assert.equal(await page.getByLabel('Timezone', { exact: true }).inputValue(), 'America/Toronto');
  await closeAccountMenu();
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Synthetic Maya', exact: true }).click();
  await expect(page.getByText('Synthetic walk', { exact: true })).toBeVisible();
  await logout();
  stage = 'captured-recovery-email';
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email', { exact: true }).fill(fixture.email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await page.getByText('Check your email.', { exact: true }).waitFor();
  const link = await capturedLink(
    (url) =>
      url.origin === 'http://127.0.0.1:54321' &&
      url.pathname === '/auth/v1/verify' &&
      url.searchParams.get('type') === 'recovery',
  );
  const verified = await context.request.get(link, { maxRedirects: 0 });
  const destination = verified.headers().location;
  assert.equal(new URL(destination).origin, 'http://127.0.0.1:5173');
  assert.equal(new URL(destination).pathname, '/reset-password');
  stage = 'managed-password-reset';
  await page.goto(destination);
  await expect(page.getByRole('button', { name: 'Update password' })).toBeEnabled();
  assert.equal(new URL(page.url()).hash, '');
  stage = 'same-password-reset';
  await page.getByLabel('New password', { exact: true }).fill(fixture.password);
  await page.getByLabel('Confirm password', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Choose a password different from your current one.',
  );
  stage = 'replacement-password-reset';
  await page.getByLabel('New password', { exact: true }).fill(fixture.replacement);
  await page.getByLabel('Confirm password', { exact: true }).fill(fixture.replacement);
  await page.getByRole('button', { name: 'Update password' }).click();
  await page.getByRole('heading', { name: 'Keep your people close.' }).waitFor();
  stage = 'replacement-password';
  const old = await context.request.post(
    'http://127.0.0.1:54321/auth/v1/token?grant_type=password',
    {
      headers: { apikey: fixture.publicKey },
      data: { email: fixture.email, password: fixture.password },
    },
  );
  assert.equal(old.status(), 400);
  await login(fixture.replacement);
  await logout();
  assert.equal((await context.request.get('http://127.0.0.1:8000/api/profile')).status(), 401);
  stage = 'passed';
  await context.close();
} catch (failure) {
  diagnostics.sourceLine = Number(failure.stack?.match(/local_browser_auth\.mjs:(\d+):/)?.[1] ?? 0);
  // Playwright exceptions may contain filled values or reset URLs. Do not print them.
  process.exitCode = 1;
} finally {
  await browser?.close();
  process.stdout.write(JSON.stringify({ stage, diagnostics }) + '\n');
}
