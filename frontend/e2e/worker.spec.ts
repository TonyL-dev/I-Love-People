import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4174';

test('production worker caches only public bundles and displays optional names', async ({
  page,
  context,
}) => {
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
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const worker = context
    .serviceWorkers()
    .find((candidate) => candidate.url() === origin + '/service-worker.js');
  expect(worker).toBeDefined();
  // Exercise the installed worker without depending on a native notification daemon in CI.
  const notifications = await worker!.evaluate(async () => {
    const registration = (self as unknown as { registration: ServiceWorkerRegistration })
      .registration;
    const original = registration.showNotification;
    const notifications: { title: string; body: string | undefined; tag: string | undefined }[] =
      [];
    let work: Promise<unknown> | undefined;
    registration.showNotification = async (title, options) => {
      notifications.push({ title, body: options?.body, tag: options?.tag });
    };
    try {
      for (const payload of [
        { name: 'Synthetic Maya', url: 'https://example.test/' },
        { type: 'catch-up', name: 'Synthetic  Maïa' },
        { type: 'catch-up', name: 'Synthetic  Maïa', tag: 'a'.repeat(32) },
        { type: 'catch-up', tag: 'b'.repeat(32) },
        null,
      ]) {
        self.dispatchEvent(
          Object.assign(new Event('push'), {
            data: {
              json: () => {
                if (payload === null) throw new SyntaxError('Synthetic malformed payload');
                return payload;
              },
            },
            waitUntil: (result: Promise<unknown>) => {
              work = result;
            },
          }),
        );
        await work;
      }
      return notifications;
    } finally {
      registration.showNotification = original;
    }
  });
  const generic = {
    title: 'I Love People',
    body: 'A little time to reconnect. Open I Love People when you have a moment.',
    tag: 'ilp-catch-up',
  };
  expect(notifications).toEqual([
    generic,
    { ...generic, body: 'A little time to reconnect with Synthetic Maïa.' },
    { ...generic, body: 'A little time to reconnect with Synthetic Maïa.', tag: 'a'.repeat(32) },
    { ...generic, tag: 'b'.repeat(32) },
    generic,
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
