/// <reference lib="webworker" />

/*
 * This file (which will be your service worker)
 * is picked up by the build system ONLY if
 * quasar.config.js > pwa > workboxMode is set to "injectManifest"
 */

declare const self: ServiceWorkerGlobalScope &
  typeof globalThis & {
    skipWaiting: () => void;
  };

import { clientsClaim } from 'workbox-core';
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

// Обработка сообщений от клиентов
self.addEventListener('message', (event) => {
  console.log('SW: Received message:', event.data);

  if (event.data?.type === 'SKIP_WAITING') {
    console.log('SW: Received SKIP_WAITING command');
    self.skipWaiting();
  }
});

// Обработка установки SW
self.addEventListener('install', (event) => {
  console.log('SW: Installing new service worker');
  // Пропускаем waiting phase только после завершения всех операций
  event.waitUntil(
    Promise.all([
      // Убеждаемся что precaching завершен
      new Promise((resolve) => {
        precacheAndRoute(self.__WB_MANIFEST);
        resolve(void 0);
      }),
      cleanupOutdatedCaches(),
    ]).then(() => {
      console.log('SW: Installation complete, calling skipWaiting');
      self.skipWaiting();
    }),
  );
});

// Обработка активации SW
self.addEventListener('activate', (event) => {
  console.log('SW: Activating new service worker');
  event.waitUntil(
    Promise.all([
      clientsClaim(),
      // Уведомляем всех клиентов об обновлении
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATED',
            payload: { timestamp: Date.now() },
          });
        });
      }),
    ]).then(() => {
      console.log('SW: Activation complete');
    }),
  );
});

// Стратегия для конфигурационных файлов - всегда с сервера, но с fallback
registerRoute(
  ({ url }) =>
    url.pathname === '/config.js' || url.pathname === '/config.default.js',
  new NetworkFirst({
    cacheName: 'config-cache',
    networkTimeoutSeconds: 2, // Сокращаем таймаут до 2 секунд
    plugins: [
      {
        cacheKeyWillBeUsed: async ({ request }) => {
          // Добавляем timestamp только для запросов с сервера
          if (
            request.mode === 'navigate' ||
            request.destination === 'document'
          ) {
            const url = new URL(request.url);
            url.searchParams.set('t', Date.now().toString());
            return url.toString();
          }
          return request.url;
        },
      },
    ],
  }),
);

// Non-SSR fallback to index.html
// Production SSR fallback to offline.html (except for dev)
if (process.env.MODE !== 'ssr' || process.env.PROD) {
  registerRoute(
    new NavigationRoute(
      createHandlerBoundToURL(process.env.PWA_FALLBACK_HTML),
      {
        denylist: [
          // Service Worker и Workbox файлы
          /sw\.js$/,
          /workbox-(.)*\.js$/,
          // Конфигурационные файлы
          /config\.js$/,
          /config\.default\.js$/,
          // Все статические ресурсы
          /\/assets\//,
          /\.js$/,
          /\.css$/,
          /\.woff2?$/,
          /\.png$/,
          /\.jpg$/,
          /\.jpeg$/,
          /\.gif$/,
          /\.svg$/,
          /\.ico$/,
          /\.json$/,
          /\.xml$/,
          // API routes
          /\/api\//,
          /\/v1\//,
        ],
      },
    ),
  );
}
