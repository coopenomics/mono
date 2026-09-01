import { ssrMiddleware } from 'quasar/wrappers';
import { EnvVars } from '../../src/shared/config/Environment';

/**
 * SSR middleware для инъекции переменных окружения
 * Работает двумя способами:
 * 1. Инъекция в HTML (для SSR) - как раньше
 * 2. Отдельный маршрут /config.js (для PWA fallback)
 */
export default ssrMiddleware(({ app }) => {
  // Функция для получения переменных окружения
  const getEnvForClient = (): EnvVars => ({
    NODE_ENV: process.env.NODE_ENV as string,
    BACKEND_URL: process.env.BACKEND_URL as string,
    CHAIN_URL: process.env.CHAIN_URL as string,
    CHAIN_ID: process.env.CHAIN_ID as string,
    CURRENCY: process.env.CURRENCY as string,
    COOP_SHORT_NAME: process.env.COOP_SHORT_NAME as string,
    SITE_DESCRIPTION: process.env.SITE_DESCRIPTION as string,
    SITE_IMAGE: process.env.SITE_IMAGE as string,
    STORAGE_URL: process.env.STORAGE_URL as string,
    UPLOAD_URL: process.env.UPLOAD_URL as string,
    TIMEZONE: process.env.TIMEZONE || 'Europe/Moscow',
    VUE_ROUTER_MODE: process.env.VUE_ROUTER_MODE as string,
    VUE_ROUTER_BASE: process.env.VUE_ROUTER_BASE as string,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY as string,
    SENTRY_DSN: process.env.SENTRY_DSN as string,
    OPENREPLAY_PROJECT_KEY: process.env.OPENREPLAY_PROJECT_KEY as string,
    YANDEX_MAPS_API_KEY: process.env.YANDEX_MAPS_API_KEY as string,
    // CoopID (Эпик 5): без этих трёх на клиенте вход по паролю недоступен —
    // `loginWithPassword` проверяет `env.COOPID_ISSUER` и отдаёт «войдите по
    // ключу доступа». Список здесь свой, а не из createEnvObject(): SPA и SSR
    // получают переменные разными путями, и сводить их в один источник —
    // отдельная задача. Поэтому при добавлении переменной клиента её нужно
    // дописать в ОБА middleware (injectEnv + generateConfig) и в
    // createEnvObject — иначе она просто не доедет до браузера.
    // 22.08.2026: так и вышло — переменные стояли в контейнере, а до браузера
    // не доезжали; пайщик после ротации ключа остался без входа вовсе.
    COOPID_ISSUER: process.env.COOPID_ISSUER as string,
    COOPID_CLIENT_ID: process.env.COOPID_CLIENT_ID as string,
    COOPID_TRUST_ANCHOR_KEY: process.env.COOPID_TRUST_ANCHOR_KEY as string,
  });

  // 1. Middleware для инъекции в HTML (основной способ)
  app.use((req, res, next) => {
    const envForClient = getEnvForClient();

    // Создаем скрипт, который добавит переменные в window.__APP_CONFIG__
    const script = `
    <script>
      window.__APP_CONFIG__ = ${JSON.stringify(envForClient)};
      console.log('SSR: Переменные окружения загружены в HTML');
    </script>
    `;

    // Оригинальный метод отправки HTML
    const originalSend = res.send;

    // Переопределяем метод, чтобы вставить наш скрипт перед закрывающим тегом </head>
    res.send = function (html) {
      if (typeof html === 'string') {
        // Перенаправляем <link rel="manifest"> на динамический /manifest.webmanifest
        // (см. dynamicManifest.ts): статический /manifest.json перехватывается
        // serveStatic до middleware, поэтому имя коопа отдаём по другому пути.
        html = html.replace(
          /(<link[^>]*rel=["']?manifest["']?[^>]*href=["']?)[^"'\s>]*(["']?[^>]*>)/i,
          '$1/manifest.webmanifest$2',
        );

        // На iOS имя на домашнем экране берётся из apple-mobile-web-app-title,
        // а не из manifest. Build-time значение generic — подставляем имя коопа
        // из env в рантайме (idempotent: replace если тег есть, иначе insert).
        const appleTitle =
          (process.env.COOP_SHORT_NAME as string) || 'Цифровой Кооператив';
        const appleMeta = `<meta name="apple-mobile-web-app-title" content="${appleTitle}">`;
        if (/<meta name="apple-mobile-web-app-title"[^>]*>/.test(html)) {
          html = html.replace(/<meta name="apple-mobile-web-app-title"[^>]*>/, appleMeta);
        } else {
          html = html.replace('</head>', `${appleMeta}</head>`);
        }
        html = html.replace('</head>', `${script}</head>`);
      }
      return originalSend.call(this, html);
    };

    // Продолжаем обработку запроса
    next();
  });

  // 2. Отдельный маршрут для PWA fallback
  app.get('/config.js', (req, res) => {
    const envForClient = getEnvForClient();

    // Создаем JavaScript файл с конфигурацией
    const configScript = `
// Конфигурация переменных окружения для клиента (PWA fallback)
// Автоматически сгенерировано SSR middleware
window.__APP_CONFIG__ = ${JSON.stringify(envForClient, null, 2)};
console.log('Config.js: Переменные окружения загружены через отдельный маршрут');
`;

    // Устанавливаем заголовки для предотвращения кэширования
    res.set({
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });

    // Отправляем JavaScript файл
    res.send(configScript);
  });
});
