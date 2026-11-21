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
  await openAccountMenu(page);
  await page.getByLabel('Timezone', { exact: true }).fill('America/Toronto');
  await page.getByRole('button', { name: 'Save timezone' }).click();
  await expect(page.getByRole('status')).toContainText('Timezone saved');
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

async function setAccountAppearance(page: Page, value: string) {
  const drawer = await openAccountMenu(page);
  await drawer.getByLabel('Appearance', { exact: true }).selectOption(value);
  await drawer.getByRole('button', { name: 'Close', exact: true }).click();
}

async function expectToastAlignment(page: Page) {
  const alignment = await page.locator('.toast__message').evaluate((message) => {
    const icon = message.querySelector('svg')!.getBoundingClientRect();
    const text = message.querySelector('span')!.getBoundingClientRect();
    return {
      iconRight: icon.right,
      textLeft: text.left,
      centerDifference: Math.abs(
        icon.y + icon.height / 2 - text.y - parseFloat(getComputedStyle(message).lineHeight) / 2,
      ),
    };
  });
  expect(alignment.iconRight).toBeLessThan(alignment.textLeft);
  expect(alignment.centerDifference).toBeLessThan(2);
}

test('login, account preferences, reload and logout clear private UI and credential storage', async ({
  page,
}) => {
  await mockAccount(page);
  await page.goto('/');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Your private space.' })).toBeVisible();
  await openAccountMenu(page);
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
  await page.mouse.click(5, 450);
  await expect(drawer).toHaveCount(0);
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
  await page.route('**/api/push/**', (route) => {
    const action = route.request().url().split('/').at(-1);
    if (action === 'config') return route.fulfill({ json: { public_key: 'AQ' } });
    if (action === 'status') return route.fulfill({ json: { quiet_start: 1260, quiet_end: 540 } });
    calls.push(action ?? '');
    if (action === 'unsubscribe') return route.fulfill({ status: 204 });
    const data = route.request().postDataJSON() as { quiet_start: number; quiet_end: number };
    return route.fulfill({ json: { quiet_start: data.quiet_start, quiet_end: data.quiet_end } });
  });
  await page.goto('/');
  await signIn(page);
  const drawer = await openAccountMenu(page);
  const scope = drawer.getByRole('region', { name: 'Notifications on this device' });
  const enable = scope.getByRole('button', { name: 'Enable on this device' });
  await expect(enable).toBeEnabled();
  expect(calls).toEqual([]);
  await enable.click();
  await expect(scope.getByText('Enabled on this device.', { exact: true })).toBeVisible();
  await scope.getByLabel('Quiet hours start').fill('22:00');
  await scope.getByRole('button', { name: 'Save quiet hours' }).click();
  await expect(scope.getByText('Quiet hours saved.')).toBeVisible();
  for (const [width, colorScheme] of [
    [390, 'light'],
    [1440, 'dark'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme });
    await scope.getByRole('heading').scrollIntoViewIfNeeded();
    await expect
      .poll(() => drawer.evaluate((node) => node.scrollWidth <= node.clientWidth))
      .toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`notifications-${width}-${colorScheme}.png`),
    });
  }
  await drawer.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    drawer.getByRole('checkbox', { name: 'Turn off notifications on this device' }),
  ).toBeChecked();
  await drawer.getByRole('button', { name: 'Confirm sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(calls).toEqual(['device', 'device', 'unsubscribe']);
});
