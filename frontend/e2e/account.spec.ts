import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const owner = '11111111-1111-4111-8111-111111111111';

async function mockAccount(page: Page, expires = 3600, protectedPreview = false) {
  let timezone = 'UTC';
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
