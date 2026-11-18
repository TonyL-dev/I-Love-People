// Live synthetic journey. Credentials arrive on stdin; no traces, video, or credential screenshots.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

const fixture = JSON.parse(readFileSync(0, 'utf8'));
let stage = 'browser-start';
let browser;
const diagnostics = { navigation: false, loginStatus: 0, profileStatus: 0, pageError: false };
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
  async function logout() {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm sign out' }).click();
    await page.getByRole('heading', { name: 'Keep your people close.' }).waitFor();
  }
  stage = 'navigation';
  await page.goto('http://127.0.0.1:5173/');
  diagnostics.navigation = true;
  stage = 'managed-login';
  await login(fixture.password);
  stage = 'owned-preference';
  await page.getByLabel('Timezone', { exact: true }).fill('America/Toronto');
  await page.getByRole('button', { name: 'Save timezone' }).click();
  await page.getByText('Timezone saved.', { exact: true }).waitFor();
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
  mkdirSync('artifacts/local', { recursive: true });
  for (const appearance of ['light', 'dark']) {
    await page.getByLabel('Appearance', { exact: true }).selectOption(appearance);
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
        path: `artifacts/local/phase2-${appearance}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.getByRole('button', { name: 'Log meetup', exact: true }).click();
  await page.screenshot({ path: 'artifacts/local/phase2-meetup-dialog.png', fullPage: true });
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
  assert.equal(await page.getByLabel('Timezone', { exact: true }).inputValue(), 'America/Toronto');
  await page.getByRole('button', { name: 'Synthetic Maya', exact: true }).click();
  await expect(page.getByText('Synthetic walk', { exact: true })).toBeVisible();
  await logout();
  stage = 'captured-recovery-email';
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email', { exact: true }).fill(fixture.email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await page.getByText('Check your email.', { exact: true }).waitFor();
  let link;
  const deadline = Date.now() + 15_000;
  while (!link && Date.now() < deadline) {
    const listing = await (
      await context.request.get('http://127.0.0.1:54324/api/v1/messages?limit=1000')
    ).json();
    for (const message of listing.messages) {
      if (!message.To.some((recipient) => recipient.Address === fixture.email)) continue;
      const detail = await (
        await context.request.get('http://127.0.0.1:54324/api/v1/message/' + message.ID)
      ).json();
      for (const match of detail.HTML.matchAll(/href="([^"]+)"/g)) {
        const value = match[1].replaceAll('&amp;', '&');
        const url = new URL(value);
        if (
          url.origin === 'http://127.0.0.1:54321' &&
          url.pathname === '/auth/v1/verify' &&
          url.searchParams.get('type') === 'recovery'
        )
          link = value;
      }
    }
    if (!link) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(link);
  const verified = await context.request.get(link, { maxRedirects: 0 });
  const destination = verified.headers().location;
  assert.equal(new URL(destination).origin, 'http://127.0.0.1:5173');
  assert.equal(new URL(destination).pathname, '/reset-password');
  stage = 'managed-password-reset';
  await page.goto(destination);
  await page.getByRole('button', { name: 'Update password' }).waitFor();
  assert.equal(new URL(page.url()).hash, '');
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
} catch {
  // Playwright exceptions may contain filled values or reset URLs. Do not print them.
  process.exitCode = 1;
} finally {
  await browser?.close();
  process.stdout.write(JSON.stringify({ stage, diagnostics }) + '\n');
}
