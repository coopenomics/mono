/* eslint-disable */
/*
 * Push-обработчик service worker'а.
 *
 * Подключается в СГЕНЕРИРОВАННЫЙ Workbox'ом service-worker.js через
 * `importScripts` (см. quasar.config.cjs → pwa.extendGenerateSWOptions →
 * cfg.importScripts). Это единственный РАБОЧИЙ источник push-логики на проде:
 * режим `workboxMode: 'GenerateSW'` игнорирует sourceFiles.serviceWorker, из-за
 * чего обработчик в src-pwa/custom-service-worker.ts в прод НЕ попадал и push
 * приходил в браузер, но не показывался (бэкенд при этом честно «sent»).
 *
 * Файл в public/ → Quasar кладёт его в корень сборки, importScripts видит как
 * /push-sw.js. Это обычный SW-скрипт (не ES-модуль): только self.addEventListener.
 */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      // web-push шлёт JSON-строку {title, body, icon, badge, image, url, tag, ...}
      data = event.data.json();
    }
  } catch (e) {
    try {
      data = { body: event.data && event.data.text() };
    } catch (e2) {
      data = {};
    }
  }

  const title = data.title || 'Новое уведомление';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-192x192.png',
    image: data.image,
    tag: data.tag || 'general',
    requireInteraction: !!data.requireInteraction,
    silent: !!data.silent,
    data: {
      url: data.url || '/',
      timestamp: data.timestamp || Date.now(),
    },
  };
  if (Array.isArray(data.actions) && data.actions.length) {
    options.actions = data.actions;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Если вкладка приложения уже открыта — фокусируем и навигируем её.
        for (const client of clients) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client && url !== '/') {
              try {
                client.navigate(url);
              } catch (e) {
                /* navigate доступен не всегда — не критично */
              }
            }
            return;
          }
        }
        // Иначе открываем новую вкладку.
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
