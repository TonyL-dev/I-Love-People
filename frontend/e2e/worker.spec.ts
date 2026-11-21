import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4174';

test('production worker caches only public bundles and shows a generic desktop notification', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['notifications'], { origin });
  const cdp = await context.newCDPSession(page);
  let registrationId: string | undefined;
  cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
    registrationId = registrations.find((item) => item.scopeURL === origin + '/')?.registrationId;
  });
  await cdp.send('ServiceWorker.enable');
  await page.route(origin + '/api/auth/config', (route) =>
    route.fulfill({
      json: {
        url: 'https://auth.example',
        publishable_key: 'sb_publishable_synthetic',
        minimum_password_length: 12,
      },
    }),
  );
  await page.goto(origin);
  await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  await expect.poll(() => registrationId).toBeTruthy();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin,
    registrationId: registrationId!,
    data: JSON.stringify({ name: 'Synthetic Maya', url: 'https://example.test/' }),
  });
  const notifications = () =>
    page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return (await registration.getNotifications()).map(({ title, body, tag }) => ({
        title,
        body,
        tag,
      }));
    });
  await expect.poll(notifications).toEqual([
    {
      title: 'I Love People',
      body: 'A little time to reconnect. Open I Love People when you have a moment.',
      tag: 'ilp-catch-up',
    },
  ]);

  const manifest = await page.request.get(origin + '/manifest.webmanifest');
  expect(await manifest.json()).toMatchObject({ display: 'standalone', start_url: '/' });
  const cachedPaths = await page.evaluate(async () => {
    const names = await caches.keys();
    return (await Promise.all(names.map(async (name) => (await caches.open(name)).keys())))
      .flat()
      .map((request) => new URL(request.url).pathname);
  });
  expect(cachedPaths.length).toBeGreaterThan(1);
  expect(cachedPaths.every((path) => /^\/assets\/.+\.(js|css)$/.test(path))).toBe(true);

  await page.getByLabel('Email', { exact: true }).fill('draft@example.test');
  await context.setOffline(true);
  await expect(page.getByText('Reconnect before saving.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('draft@example.test');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'You’re offline.' })).toBeVisible();
  await expect(page.getByText('draft@example.test')).toHaveCount(0);
});
