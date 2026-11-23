/* global self, caches, fetch, Response, URL, __PUBLIC_ASSETS__ */
const { cacheName, files } = __PUBLIC_ASSETS__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      await Promise.all(
        files.map(async (path) => {
          const response = await fetch(path, { cache: 'reload', redirect: 'error' });
          const mime = response.headers.get('content-type') ?? '';
          const validType = path.endsWith('.css')
            ? mime.includes('text/css')
            : mime.includes('javascript');
          if (
            !response.ok ||
            !validType ||
            response.url !== new URL(path, self.location.origin).href
          )
            throw new Error('Public app assets could not be installed.');
          await cache.put(path, response);
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('ilp-public-') && name !== cacheName)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

const publicStylesheet = files.find((path) => path.endsWith('.css'));
const offlinePage = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="color-scheme" content="light dark">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Offline · I Love People</title>
      ${publicStylesheet ? `<link rel="stylesheet" href="${publicStylesheet}">` : ''}
    </head>
    <body><main class="main-content">
      <section class="login stack">
        <h1>You’re offline.</h1>
        <p>Reconnect to open your private space.</p>
        <a class="button button--primary self-start" href="">Try again</a>
      </section>
    </main></body>
  </html>`;

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/')
  )
    return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(offlinePage, {
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
          }),
      ),
    );
  } else if (!url.search && files.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(cacheName);
        return (await cache.match(url.pathname)) ?? fetch(request);
      })(),
    );
  }
});

function reminderBody(data) {
  const generic = 'A little time to reconnect. Open I Love People when you have a moment.';
  try {
    const payload = data?.json();
    if (payload?.type === 'catch-up' && typeof payload.name === 'string') {
      const name = payload.name.replace(/\s+/g, ' ').trim();
      if (name && [...name].length <= 120) return `A little time to reconnect with ${name}.`;
    }
  } catch {
    // Older or malformed payloads still produce a generic reminder.
  }
  return generic;
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('I Love People', {
      body: reminderBody(event.data),
      icon: '/icons/app-192.png',
      tag: 'ilp-catch-up',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => {
        const url = new URL(client.url);
        return (
          url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/login')
        );
      });
      if (existing) await existing.focus();
      else await self.clients.openWindow('/');
    })(),
  );
});
