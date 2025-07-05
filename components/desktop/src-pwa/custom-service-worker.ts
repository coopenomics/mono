/*
 * This file (which will be your service worker)
 * is picked up by the build system ONLY if
 * quasar.config.js > pwa > workboxMode is set to "injectManifest"
 */

declare const self: ServiceWorkerGlobalScope &
  typeof globalThis & { skipWaiting: () => void };

import { clientsClaim } from 'workbox-core';
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

self.skipWaiting();
clientsClaim();

// Use with precache injection
precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();

// Специальные маршруты для конфигурационных файлов - всегда загружать с сервера
registerRoute(
  ({ url }) =>
    url.pathname === '/config.js' || url.pathname === '/config.default.js',
  new NetworkFirst({
    cacheName: 'config-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      {
        cacheKeyWillBeUsed: async ({ request }) => {
          // Добавляем timestamp чтобы избежать кэширования
          const url = new URL(request.url);
          url.searchParams.set('t', Date.now().toString());
          return url.toString();
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
