import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const owner = '11111111-1111-4111-8111-111111111111';

async function mockAccount(page: Page, expires = 3600, protectedPreview = false, signup = false) {
  let timezone = 'UTC';
  await page.route('**/api/people', (route) => route.fulfill({ json: [] }));
  if (protectedPreview) {
    await page.context().addCookies([
      { name: 'preview-protection', value: 'synthetic', url: 'http://127.0.0.1:5173' },
      { name: 'provider-cookie', value: 'must-not-send', url: 'https://auth.example' },
    ]);
  }
  const hasPreviewAccess = (cookie: string | undefined) =>
    !protectedPreview || Boolean(cookie?.includes('preview-protection=synthetic'));
  await page.route('**/api/auth/config', (route) => {
    if (!hasPreviewAccess(route.request().headers().cookie))
      return route.fulfill({ status: 401, json: {} });
    return route.fulfill({
      json: {
        url: 'https://auth.example',
        publishable_key: 'sb_publishable_synthetic',
        minimum_password_length: 12,
        signup_enabled: signup,
      },
    });
  });
  await page.route('https://auth.example/auth/v1/**', async (route) => {
    expect(route.request().headers().cookie).toBeUndefined();
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'apikey,content-type,authorization',
      'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    };
    if (route.request().method() === 'OPTIONS' || route.request().url().includes('/logout')) {
      await route.fulfill({ status: 204, headers });
      return;
    }
    await route.fulfill({
      headers,
      json: route.request().url().includes('/token?')
        ? {
            access_token: 'synthetic-access',
            refresh_token: 'must-not-persist',
            expires_in: expires,
          }
        : {},
    });
  });
  await page.route('**/api/profile', async (route) => {
    if (!hasPreviewAccess(route.request().headers().cookie)) {
      await route.fulfill({ status: 401, json: {} });
      return;
    }
    if (route.request().method() === 'PUT')
      timezone = (route.request().postDataJSON() as { timezone: string }).timezone;
    await route.fulfill({ json: { owner_id: owner, timezone } });
  });
}

test('Preview protection cookies reach the same-origin API without reaching Auth', async ({
  page,
}) => {
  await mockAccount(page, 3600, true);
  await page.goto('/');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Your private space.' })).toBeVisible();
  await openAccountMenu(page);
  await page.getByLabel('Timezone', { exact: true }).selectOption('America/Toronto');
  await page.getByRole('button', { name: 'Save timezone' }).click();
  await expect(page.locator('.toast').getByRole('status')).toHaveText('Timezone saved.');
});

test('signup blocks input with a centered heart and preserves input after rate limiting', async ({
  page,
}) => {
  await mockAccount(page, 3600, false, true);
  let result = 429;
  const releases: Array<() => void> = [];
  await page.route('https://auth.example/auth/v1/signup', async (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'apikey,content-type',
      'access-control-allow-methods': 'POST,OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    await new Promise<void>((resolve) => {
      releases.push(resolve);
    });
    return route.fulfill({
      status: result,
      headers,
      json: result === 429 ? { error_code: 'over_email_send_rate_limit' } : {},
    });
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Create account' }).click();
  await page.getByLabel('Email', { exact: true }).fill('new@example.test');
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('SyntheticPassword123');
  const submit = page.getByRole('button', { name: 'Create account' });
  await submit.click();
  const overlay = page.getByRole('dialog', { name: 'Loading' });
  await expect(overlay).toBeVisible();
  const heart = overlay.locator('.loading-heart');
  await expect(heart.locator('path')).toHaveCSS('animation-name', 'trace-heart');
  const desktop = await heart.boundingBox();
  expect(desktop?.width).toBeGreaterThan(400);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await expect(heart.locator('path')).toHaveCSS('animation-name', 'none');
  const phone = (await heart.boundingBox())!;
  expect(phone.width).toBeGreaterThan(270);
  expect(phone.x + phone.width / 2).toBeCloseTo(195, 0);
  expect(phone.y + phone.height / 2).toBeCloseTo(422, 0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await page.mouse.click(40, 27);
  await expect(overlay).toBeVisible();
  await expect(page).toHaveURL(/\/create-account$/);
  expect(await page.evaluate(() => document.activeElement?.closest('form') === null)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('loading-heart-dark-phone.png') });
  await expect.poll(() => releases.length).toBe(1);
  releases.shift()?.();
  await expect(page.getByRole('alert')).toHaveText(
    'Too many attempts. Wait a little before trying again.',
  );
  await expect(overlay).toBeHidden();
  await expect(password).toHaveValue('SyntheticPassword123');
  result = 200;
  await submit.click();
  await expect.poll(() => releases.length).toBe(1);
  releases.shift()?.();
  await expect(
    page.getByRole('status').filter({ hasText: 'a confirmation link is on its way' }),
  ).toBeVisible();
  await expect(overlay).toBeHidden();
  await expect(password).toHaveCount(0);
});

test('the overlay blocks the drawer until every pending API request finishes', async ({ page }) => {
  await mockAccount(page);
  let releaseSave: (() => void) | undefined;
  let releaseRefresh: (() => void) | undefined;
  await page.route('**/api/profile', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    await new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    await route.fulfill({ json: { owner_id: owner, timezone: 'America/Toronto' } });
  });
  await page.goto('/');
  await signIn(page);
  const drawer = await openAccountMenu(page);
  await page.route('**/api/people', async (route) => {
    await new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    await route.fulfill({ json: [] });
  });
  await drawer.getByLabel('Timezone', { exact: true }).selectOption('America/Toronto');
  await drawer.getByRole('button', { name: 'Save timezone' }).click();
  const overlay = page.getByRole('dialog', { name: 'Loading' });
  await expect(overlay).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#account-menu')).toBeVisible();
  expect(await overlay.evaluate((node) => node.matches(':modal'))).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => typeof releaseRefresh).toBe('function');
  await expect.poll(() => typeof releaseSave).toBe('function');
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/profile') && response.request().method() === 'PUT',
  );
  releaseSave?.();
  await saved;
  await expect(page.locator('#account-menu .toast')).toContainText('Timezone saved.');
  await expect(overlay).toBeVisible();
  releaseRefresh?.();
  await expect(overlay).toBeHidden();
  await expect(drawer.locator('.toast')).toContainText('Timezone saved.');
});

async function signIn(page: Page) {
  await page.getByLabel('Email', { exact: true }).fill('synthetic@example.test');
  await page.getByLabel('Password', { exact: true }).fill('SyntheticPassword123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function openAccountMenu(page: Page) {
  const drawer = page.getByRole('dialog', { name: 'Settings and account' });
  if (!(await drawer.isVisible()))
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
  return drawer;
}

test('backup review, conflict, download and password confirmation work on a phone layout', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockAccount(page);
  const backup = { version: 1, timezone: 'America/Toronto', people: [], meetups: [] };
  let currentPeople = 1;
  let deletionAttempts = 0;
  await page.route('**/api/privacy/**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer synthetic-access');
    const url = route.request().url();
    if (url.endsWith('/backup')) return route.fulfill({ json: backup });
    if (url.endsWith('/preview')) {
      if (route.request().postData() === 'invalid') return route.fulfill({ status: 422, json: {} });
      expect(route.request().postDataJSON()).toEqual(backup);
      return route.fulfill({
        json: {
          current_people: currentPeople,
          current_timezone: 'UTC',
          timezone: backup.timezone,
          people: 0,
          meetups: 0,
          preview_token: 'a'.repeat(64),
        },
      });
    }
    if (url.endsWith('/delete-all')) {
      expect(route.request().postDataJSON()).toEqual({
        password: 'SyntheticPassword123',
        confirmation: 'DELETE',
      });
      deletionAttempts++;
      if (deletionAttempts === 1) return route.fulfill({ status: 403, json: {} });
    } else {
      expect(route.request().postDataJSON()).toEqual({
        backup,
        preview_token: 'a'.repeat(64),
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return route.fulfill({ status: 204 });
  });

  await page.goto('/');
  await signIn(page);
  const drawer = await openAccountMenu(page);
  const privacy = drawer.getByRole('region', { name: 'Backups and data' });
  const downloaded = page.waitForEvent('download');
  await privacy.getByRole('button', { name: 'Download backup' }).click();
  expect((await downloaded).suggestedFilename()).toBe('i-love-people-backup.json');
  await expect(drawer.locator('.toast').getByRole('status')).toHaveText(
    'Backup ready. Check your downloads.',
  );
  await expectToastAlignment(page);
  await drawer.getByRole('button', { name: 'Dismiss notification' }).click();

  const file = privacy.getByLabel('Choose a backup to restore');
  const upload = (contents: string) =>
    file.setInputFiles({
      name: 'synthetic.json',
      mimeType: 'application/json',
      buffer: Buffer.from(contents),
    });
  await upload('invalid');
  await expect(privacy.getByRole('alert')).toContainText('unsupported format');
  await upload(JSON.stringify(backup));
  await expect(privacy.getByText('Restore requires an empty library.')).toBeVisible();
  await expect(privacy.getByRole('button', { name: 'Restore backup' })).toHaveCount(0);
  await privacy.getByRole('button', { name: 'Cancel restore' }).click();

  currentPeople = 0;
  await upload(JSON.stringify(backup));
  await expect(privacy.getByRole('heading', { name: 'Review backup' })).toBeVisible();
  await privacy.getByRole('button', { name: 'Restore backup' }).click();
  await expect(drawer.locator('.toast').getByRole('status')).toHaveText(
    'Restored 0 people and 0 meetups.',
  );
  await drawer.getByRole('button', { name: 'Dismiss notification' }).click();

  await privacy.getByRole('button', { name: 'Delete all data' }).click();
  const password = privacy.getByLabel('Current password');
  const confirmation = privacy.getByLabel('Type DELETE to confirm');
  const deleteButton = privacy.getByRole('button', { name: 'Permanently delete data' });
  await expect(deleteButton).toBeDisabled();
  await password.fill('SyntheticPassword123');
  await confirmation.fill('DELETE');
  await deleteButton.click();
  await expect(privacy.getByRole('alert')).toContainText('Your password could not be verified');
  await expect(password).toHaveValue('');

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await expect(drawer).toBeVisible();
      expect(await drawer.evaluate((node) => node.scrollWidth)).toBeLessThanOrEqual(
        await drawer.evaluate((node) => node.clientWidth),
      );
      if (width === 320 || width === 1440) {
        expect(
          (await new AxeBuilder({ page }).include('#account-menu').analyze()).violations,
        ).toEqual([]);
      }
    }
  }
  await page.screenshot({ path: 'artifacts/local/privacy-delete-1440.png' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  expect(await drawer.evaluate((node) => node.scrollWidth)).toBeLessThanOrEqual(
    await drawer.evaluate((node) => node.clientWidth),
  );
  await password.fill('SyntheticPassword123');
  await page.screenshot({ path: 'artifacts/local/privacy-delete-320.png' });
  await deleteButton.press('Enter');
  await expect(drawer.locator('.toast').getByRole('status')).toHaveText(
    'All application data deleted.',
  );
});

async function setAccountAppearance(page: Page, value: string) {
  const drawer = await openAccountMenu(page);
  await drawer.getByLabel('Appearance', { exact: true }).selectOption(value);
  await drawer.getByRole('button', { name: 'Close', exact: true }).click();
}

async function expectToastAlignment(page: Page) {
  const alignment = await page.locator('.toast__message').evaluate((message) => {
    const icon = message.querySelector('svg')!.getBoundingClientRect();
    const text = message.querySelector('span')!.getBoundingClientRect();
    const button = message.parentElement!.querySelector('button')!;
    const target = button.getBoundingClientRect();
    const dismiss = button.querySelector('svg')!.getBoundingClientRect();
    const toast = message.parentElement!.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(message).lineHeight);
    return {
      iconRight: icon.right,
      textLeft: text.left,
      buttonHeight: target.height,
      buttonWidth: target.width,
      dismissDifference: Math.abs(dismiss.y + dismiss.height / 2 - icon.y - icon.height / 2),
      centerDifference: Math.abs(icon.y + icon.height / 2 - text.y - lineHeight / 2),
      dismissOffsetX: Math.abs(dismiss.x + dismiss.width / 2 - target.x - target.width / 2),
      dismissOffsetY: Math.abs(dismiss.y + dismiss.height / 2 - target.y - target.height / 2),
      singleLineTargetOffset:
        text.height <= lineHeight
          ? Math.abs(target.y + target.height / 2 - toast.y - toast.height / 2)
          : 0,
    };
  });
  expect(alignment.iconRight).toBeLessThan(alignment.textLeft);
  expect(alignment.centerDifference).toBeLessThan(2);
  expect(alignment.dismissDifference).toBeLessThan(2);
  expect(alignment.buttonHeight).toBeGreaterThanOrEqual(44);
  expect(alignment.buttonWidth).toBeGreaterThanOrEqual(44);
  expect(alignment.dismissOffsetX).toBeLessThan(1);
  expect(alignment.dismissOffsetY).toBeLessThan(1);
  expect(alignment.singleLineTargetOffset).toBeLessThan(1);
}

test('login, account preferences, reload and logout clear private UI and credential storage', async ({
  page,
}) => {
  await mockAccount(page);
  await page.goto('/');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Your private space.' })).toBeVisible();
  await openAccountMenu(page);
  await page.getByRole('searchbox', { name: 'Search timezones' }).fill('Toronto');
  await page.getByRole('searchbox', { name: 'Search timezones' }).press('Enter');
  await expect(page.getByLabel('Timezone', { exact: true })).toBeFocused();
  await page.getByLabel('Timezone', { exact: true }).selectOption({ label: 'Toronto (America)' });
  await page.getByRole('button', { name: 'Save timezone' }).click();
  await expect(page.locator('.toast').getByRole('status')).toHaveText('Timezone saved.');
  expect(
    await page.evaluate(() =>
      JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
    ),
  ).not.toContain('synthetic-access');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Keep your people close.' })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('');
  await signIn(page);
  await openAccountMenu(page);
  await expect(page.getByLabel('Timezone', { exact: true })).toHaveValue('America/Toronto');
  await openAccountMenu(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Keep your people close.' })).toBeVisible();
  await expect(page.getByText('Signed in as synthetic@example.test')).toHaveCount(0);
});

test('recovery uses generic confirmation, strips tokens and returns to fresh login after reset', async ({
  page,
}) => {
  await mockAccount(page);
  await page.goto('/forgot-password');
  await page.getByLabel('Email', { exact: true }).fill('synthetic@example.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'If this address belongs' }),
  ).toBeVisible();
  await page.goto(
    '/reset-password#access_token=synthetic-recovery&refresh_token=must-not-persist&type=recovery&expires_in=3600',
  );
  await expect(page.getByRole('button', { name: 'Update password' })).toBeEnabled();
  expect(new URL(page.url()).hash).toBe('');
  await page.getByLabel('New password', { exact: true }).fill('SyntheticReplacement123');
  await page.getByLabel('Confirm password', { exact: true }).fill('SyntheticMismatch123');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  await page.getByLabel('Confirm password', { exact: true }).fill('SyntheticReplacement123');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('heading', { name: 'Keep your people close.' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Password updated' })).toBeVisible();
});

test('expired sessions remove the account view', async ({ page }) => {
  await mockAccount(page, 2);
  await page.goto('/');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Your private space.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Keep your people close.' })).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByRole('status').filter({ hasText: 'session expired' })).toBeVisible();
});

for (const appearance of ['light', 'dark']) {
  for (const width of [320, 390, 768, 1440]) {
    test(`account forms: ${appearance}, ${width}px`, async ({ page }) => {
      test.setTimeout(60_000);
      await mockAccount(page);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/design');
      await page.getByLabel('Appearance', { exact: true }).selectOption(appearance);
      for (const [name, path] of [
        ['sign-in', '/'],
        ['recovery', '/forgot-password'],
        ['reset', '/reset-password#access_token=synthetic&type=recovery&expires_in=3600'],
      ]) {
        await page.goto(path!);
        if (name === 'reset')
          await expect(page.getByRole('button', { name: 'Update password' })).toBeEnabled();
        else if (name === 'sign-in')
          await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
        else await expect(page.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({
          path: `artifacts/local/auth-${name}-${appearance}-${width}.png`,
          fullPage: true,
        });
      }
    });
  }
}

test('people and meetup browser journey, cadence confirmation and deletion', async ({ page }) => {
  await mockAccount(page);
  let people: Record<string, unknown>[] = [];
  let meetups: Record<string, unknown>[] = [];
  const timestamp = '2026-01-01T00:00:00Z';
  await page.route('**/api/people', async (route) => {
    if (route.request().method() === 'POST') {
      const person = {
        ...route.request().postDataJSON(),
        id: owner,
        revision: 1,
        created_at: timestamp,
        updated_at: timestamp,
        last_seen: null,
      };
      people.push(person);
      await route.fulfill({ json: person });
    } else await route.fulfill({ json: people });
  });
  await page.route('**/api/people/*/meetups', async (route) => {
    if (route.request().method() === 'POST') {
      const meetup = {
        ...route.request().postDataJSON(),
        id: owner,
        person_id: owner,
        revision: 1,
        created_at: timestamp,
        updated_at: timestamp,
      };
      meetups.push(meetup);
      people[0]!.last_seen = meetup.completed_on;
      await route.fulfill({ json: meetup });
    } else await route.fulfill({ json: meetups });
  });
  await page.route('**/api/people/*?revision=*', async (route) => {
    people = [];
    meetups = [];
    await route.fulfill({ json: {} });
  });
  await page.goto('/');
  await signIn(page);
  await page.getByRole('button', { name: 'Add person', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('Synthetic Maya');
  await dialog.getByLabel('Private priority').selectOption('closest');
  await expect(dialog.getByLabel('Cadence', { exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: 'Use suggested cadence: every 2 weeks' }).click();
  await expect(dialog.getByLabel('Cadence', { exact: true })).toHaveValue('weeks');
  await dialog.getByRole('button', { name: 'Save person', exact: true }).click();
  await page.getByLabel('Search people').fill('maya');
  await page.getByRole('button', { name: 'Synthetic Maya', exact: true }).click();
  await page.getByRole('button', { name: 'Log meetup', exact: true }).click();
  await dialog.getByLabel('Meetup date').fill('2020-02-29');
  await dialog.getByLabel('Note (optional)').fill('Synthetic walk');
  await dialog.getByRole('button', { name: 'Save meetup', exact: true }).click();
  await expect(page.getByText('Synthetic walk', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete person', exact: true }).click();
  await expect(dialog).toContainText('Synthetic Maya');
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('No people yet.', { exact: false })).toBeVisible();
});

test('people long names and editors reflow at large text with keyboard focus', async ({ page }) => {
  await mockAccount(page);
  const name = 'Synthetic' + 'x'.repeat(100);
  await page.route('**/api/people', (route) =>
    route.fulfill({
      json: [
        {
          id: owner,
          name,
          priority: null,
          cadence_count: null,
          cadence_unit: null,
          archived: false,
          revision: 1,
          created_at: '2020-01-01T00:00:00Z',
          updated_at: '2020-01-01T00:00:00Z',
          last_seen: null,
        },
      ],
    }),
  );
  await page.route('**/api/people/*/meetups', (route) => route.fulfill({ json: [] }));
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  await signIn(page);
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Edit person', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByLabel('Private priority')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/local/phase2-large-text-editor.png', fullPage: true });
});

const nudgePerson = {
  id: owner,
  name: 'Synthetic Maya',
  priority: 'closest',
  cadence_count: 2,
  cadence_unit: 'weeks',
  archived: false,
  revision: 1,
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2020-01-01T00:00:00Z',
  last_seen: '2020-02-29',
  paused: false,
  snoozed_until: null,
  dismissed_on: null,
  due_on: '2020-03-14',
  eligible_on: '2020-03-14',
  timing: 'now',
  suppression: null,
  reason: 'Last meetup 2020-02-29; every 2 weeks; catch-up date 2020-03-14',
};

test('library navigation, person focus and back preserve mobile context', async ({ page }) => {
  test.setTimeout(90_000);
  await mockAccount(page);
  await page.route('**/api/people', (route) => route.fulfill({ json: [nudgePerson] }));
  await page.route('**/api/people/*/meetups', (route) => route.fulfill({ json: [] }));
  await page.goto('/');
  await signIn(page);
  const nav = page.getByRole('navigation', { name: 'Your library' });
  for (const appearance of ['light', 'dark']) {
    await setAccountAppearance(page, appearance);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await nav.getByRole('button', { name: 'People', exact: true }).click();
      await expect(nav.getByRole('button', { name: 'People', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(
        await nav
          .getByRole('button', { name: 'People', exact: true })
          .evaluate((e) => getComputedStyle(e).backgroundColor),
      ).not.toBe(
        await nav
          .getByRole('button', { name: 'Catch up', exact: true })
          .evaluate((e) => getComputedStyle(e).backgroundColor),
      );
      await page.getByLabel('Search people').fill('maya');
      await page.getByRole('button', { name: 'Synthetic Maya', exact: true }).click();
      const heading = page.getByRole('heading', { name: 'Synthetic Maya', exact: true });
      await expect(heading).toBeFocused();
      await expect(page.getByLabel('Search people')).toHaveCount(0);
      const bounds = await heading.boundingBox();
      const navBounds = await nav.boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(navBounds!.y + navBounds!.height);
      expect(bounds!.y + bounds!.height).toBeLessThan(900);
      await expect(
        page.getByRole('button', { name: 'Back to People', exact: true }),
      ).toBeInViewport();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `artifacts/local/phase3-detail-${appearance}-${width}.png`,
        fullPage: false,
      });
      await page.getByRole('button', { name: 'Back to People', exact: true }).click();
      await expect(page.getByLabel('Search people')).toHaveValue('maya');
      await expect(page.getByRole('button', { name: 'Synthetic Maya', exact: true })).toBeFocused();
      await nav.getByRole('button', { name: 'Weekly review', exact: true }).click();
      await expect(nav.getByRole('button', { name: 'Weekly review', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(page.getByRole('region', { name: 'Weekly review', exact: true })).toContainText(
        nudgePerson.reason,
      );
      await nav.getByRole('button', { name: 'Catch up', exact: true }).click();
      await expect(nav.getByRole('button', { name: 'Catch up', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `artifacts/local/phase3-navigation-${appearance}-${width}.png`,
        fullPage: true,
      });
    }
  }
});

test('nudge toasts wait for success, report failures inline and pause dismissal while hovered', async ({
  page,
}) => {
  await mockAccount(page);
  let person: Record<string, unknown> = { ...nudgePerson };
  let fail = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/people', (route) => route.fulfill({ json: [person] }));
  await page.route('**/api/people/*/meetups', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/people/*/nudge', async (route) => {
    await pending;
    if (fail) return route.fulfill({ status: 409, json: {} });
    const body = route.request().postDataJSON() as {
      action: string;
      until?: string;
      revision: number;
    };
    expect(body.revision).toBe(person.revision);
    person = {
      ...person,
      revision: body.revision + 1,
      paused: body.action === 'pause',
      suppression: body.action === 'pause' ? 'paused' : body.action === 'snooze' ? 'snoozed' : null,
      snoozed_until: body.until ?? null,
    };
    await route.fulfill({ json: person });
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  await signIn(page);
  await page.getByRole('button', { name: 'More about Synthetic Maya', exact: true }).click();
  await page.getByRole('button', { name: 'Pause nudges', exact: true }).click();
  await expect(page.locator('.toast')).toHaveCount(0);
  release();
  await expect(page.locator('.toast').getByRole('status')).toHaveText('Nudges paused.');
  await expectToastAlignment(page);
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  fail = true;
  await page.getByRole('button', { name: 'Unpause nudges', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('changed in another tab');
  await expect(page.locator('.toast')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Unpause nudges', exact: true }).click();
  await expect(page.locator('.toast').getByRole('status')).toHaveText('Nudges unpaused.');
  await page.getByLabel('Snooze until', { exact: true }).fill('2099-01-01');
  await page.getByRole('button', { name: 'Snooze nudge', exact: true }).click();
  await expect(page.locator('.toast').getByRole('status')).toHaveText(
    'Nudge snoozed until 2099-01-01.',
  );
  await page.clock.install();
  await page.getByRole('button', { name: 'Dismiss notification' }).focus();
  await page.clock.fastForward(10_000);
  await expect(page.locator('.toast')).toBeVisible();
  await setAccountAppearance(page, 'dark');
  await page.getByRole('button', { name: 'Dismiss notification' }).focus();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expectToastAlignment(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/local/phase3-toast-large-dark.png', fullPage: false });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole('heading', { name: 'Synthetic Maya', exact: true }).focus();
  await page.locator('.toast').hover();
  await page.clock.fastForward(10_000);
  await expect(page.locator('.toast')).toBeVisible();
  await page.screenshot({ path: 'artifacts/local/phase3-success-toast.png', fullPage: false });
  await page.mouse.move(0, 0);
  await page.clock.fastForward(7001);
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.getByLabel('Snooze until', { exact: true }).fill('2099-02-01');
  await page.getByRole('button', { name: 'Snooze nudge', exact: true }).click();
  await expect(page.locator('.toast').getByRole('status')).toHaveText(
    'Nudge snoozed until 2099-02-01.',
  );
  await openAccountMenu(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('settings drawer stays out of the library and preserves context with keyboard and backdrop close', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await mockAccount(page);
  await page.route('**/api/people', (route) => route.fulfill({ json: [nudgePerson] }));
  await page.route('**/api/people/*/meetups', (route) => route.fulfill({ json: [] }));
  await page.goto('/');
  await signIn(page);
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page.getByLabel('Search people').fill('maya');
  await page.getByRole('button', { name: 'Synthetic Maya', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your preferences', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toHaveCount(0);
  const overlay = page.getByRole('dialog', { name: 'Loading' });
  for (const appearance of ['light', 'dark']) {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const drawer = await openAccountMenu(page);
      await expect(drawer.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
      await expect(
        page.getByRole('button', { name: 'Menu', exact: true, includeHidden: true }),
      ).toHaveAttribute('aria-expanded', 'true');
      await drawer.getByLabel('Appearance', { exact: true }).selectOption(appearance);
      const box = await drawer.boundingBox();
      expect(Math.round(box!.x + box!.width)).toBe(width);
      expect(box!.height).toBeLessThanOrEqual(900);
      expect(await drawer.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `artifacts/local/account-drawer-${appearance}-${width}.png` });
      await expect(overlay).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(drawer).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
      await expect(page.getByRole('region', { name: 'Profile for Synthetic Maya' })).toBeVisible();
    }
  }
  const drawer = await openAccountMenu(page);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(
      await drawer.evaluate(
        (e) => document.activeElement === document.body || e.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await drawer.getByRole('heading', { name: 'Account', exact: true }).scrollIntoViewIfNeeded();
  expect(await drawer.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await expect(drawer.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/local/account-drawer-large-dark.png' });
  // A click returning focus from browser chrome can start a background refresh.
  await expect(async () => {
    await expect(overlay).toBeHidden();
    if (await drawer.isVisible()) await page.mouse.click(5, 450);
    await expect(drawer).toBeHidden({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
  await page.getByRole('button', { name: 'Back to People', exact: true }).click();
  await expect(page.getByLabel('Search people')).toHaveValue('maya');
  await openAccountMenu(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.keyboard.press('Escape');
  await openAccountMenu(page);
  await expect(page.getByRole('button', { name: 'Confirm sign out', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
});

test('notification preferences require opt-in and sign-out turns off this device', async ({
  page,
}) => {
  await mockAccount(page);
  await page.addInitScript(() => {
    let subscription: object | null = null;
    Object.defineProperty(Notification, 'permission', {
      get: () => (subscription ? 'granted' : 'default'),
    });
    const registration = {
      active: true,
      pushManager: {
        getSubscription: () => Promise.resolve(subscription),
        subscribe: () => {
          subscription = {
            endpoint: 'https://fcm.googleapis.com/wp/synthetic-browser',
            options: {},
            toJSON: () => ({ keys: { p256dh: 'synthetic-public', auth: 'synthetic-auth' } }),
            unsubscribe: () => {
              subscription = null;
              return Promise.resolve(true);
            },
          };
          return Promise.resolve(subscription);
        },
      },
    };
    navigator.serviceWorker.getRegistration = () =>
      Promise.resolve(registration as unknown as ServiceWorkerRegistration);
  });
  const calls: string[] = [];
  let savedSettings = { quiet_start: 1260, quiet_end: 540, show_name: false };
  await page.route('**/api/push/**', (route) => {
    const action = route.request().url().split('/').at(-1);
    if (action === 'config') return route.fulfill({ json: { public_key: 'AQ' } });
    if (action === 'status') return route.fulfill({ json: savedSettings });
    calls.push(action ?? '');
    if (action === 'unsubscribe') return route.fulfill({ status: 204 });
    const { quiet_start, quiet_end, show_name } = route.request().postDataJSON() as {
      quiet_start: number;
      quiet_end: number;
      show_name: boolean;
    };
    savedSettings = { quiet_start, quiet_end, show_name };
    return route.fulfill({ json: savedSettings });
  });
  await page.goto('/');
  await signIn(page);
  const drawer = await openAccountMenu(page);
  const scope = drawer.getByRole('region', { name: 'Notifications on this device' });
  const toast = drawer.locator('.toast');
  const dismiss = toast.getByRole('button', { name: 'Dismiss notification' });
  await drawer.getByLabel('Timezone', { exact: true }).selectOption('America/Toronto');
  await drawer.getByRole('button', { name: 'Save timezone' }).click();
  await expect(toast.getByRole('status')).toHaveText('Timezone saved.');
  await dismiss.click();
  const enable = scope.getByRole('button', { name: 'Enable on this device' });
  await expect(enable).toBeEnabled();
  expect(calls).toEqual([]);
  await enable.click();
  await expect(scope.getByText('Enabled on this device.', { exact: true })).toBeVisible();
  await expect(toast.getByRole('status')).toHaveText('Notifications are enabled on this device.');
  await expect(
    scope.getByText('Quiet hours follow your account timezone (America/Toronto).'),
  ).toBeVisible();
  await dismiss.click();
  const showNames = scope.getByRole('checkbox', { name: 'Show a name in reminders' });
  await expect(showNames).not.toBeChecked();
  await expect(showNames).toHaveAccessibleDescription('The name may appear on your lock screen.');
  await showNames.check();
  await scope.getByLabel('Quiet hours start').fill('22:00');
  await scope.getByRole('button', { name: 'Save notification settings' }).click();
  await expect(toast.getByRole('status')).toHaveText('Notification settings saved.');
  expect(savedSettings).toEqual({ quiet_start: 1320, quiet_end: 540, show_name: true });
  for (const [width, colorScheme] of [
    [390, 'light'],
    [1440, 'dark'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme });
    await showNames.scrollIntoViewIfNeeded();
    await expectToastAlignment(page);
    await expect
      .poll(() => drawer.evaluate((node) => node.scrollWidth <= node.clientWidth))
      .toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`notifications-${width}-${colorScheme}.png`),
    });
  }
  await dismiss.click();
  await page.keyboard.press('Escape');
  await openAccountMenu(page);
  await expect(showNames).toBeChecked();
  await showNames.uncheck();
  await scope.getByRole('button', { name: 'Save notification settings' }).click();
  await expect(toast.getByRole('status')).toHaveText('Notification settings saved.');
  await dismiss.click();
  expect(savedSettings).toEqual({ quiet_start: 1320, quiet_end: 540, show_name: false });
  await page.keyboard.press('Escape');
  await openAccountMenu(page);
  await expect(scope.getByText('Enabled on this device.', { exact: true })).toBeVisible();
  await expect(showNames).not.toBeChecked();
  await drawer.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    drawer.getByRole('checkbox', { name: 'Turn off notifications on this device' }),
  ).toBeChecked();
  await drawer.getByRole('button', { name: 'Confirm sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(calls).toEqual(['device', 'device', 'device', 'unsubscribe']);
});
