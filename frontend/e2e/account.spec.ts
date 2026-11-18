import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const owner = '11111111-1111-4111-8111-111111111111';

async function mockAccount(page: Page, expires = 3600, protectedPreview = false) {
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
  await page.getByLabel('Timezone', { exact: true }).fill('America/Toronto');
  await page.getByRole('button', { name: 'Save timezone' }).click();
  await expect(page.getByRole('status')).toContainText('Timezone saved');
});

async function signIn(page: Page) {
  await page.getByLabel('Email', { exact: true }).fill('synthetic@example.test');
  await page.getByLabel('Password', { exact: true }).fill('SyntheticPassword123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('login, account preferences, reload and logout clear private UI and credential storage', async ({
  page,
}) => {
  await mockAccount(page);
  await page.goto('/');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Your private space.' })).toBeVisible();
  await page.getByLabel('Timezone', { exact: true }).fill('America/Toronto');
  await page.getByRole('button', { name: 'Save timezone' }).click();
  await expect(page.getByRole('status')).toContainText('Timezone saved');
  expect(
    await page.evaluate(() =>
      JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
    ),
  ).not.toContain('synthetic-access');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Keep your people close.' })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('');
  await signIn(page);
  await expect(page.getByLabel('Timezone', { exact: true })).toHaveValue('America/Toronto');
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
  await expect(page.getByRole('status')).toContainText('If this address belongs');
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
  await expect(page.getByRole('status')).toContainText('Password updated');
});

test('expired sessions remove the account view', async ({ page }) => {
  await mockAccount(page, 2);
  await page.goto('/');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Your private space.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Keep your people close.' })).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByRole('status')).toContainText('session expired');
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
