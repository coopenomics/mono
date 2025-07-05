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
    NOVU_APP_ID: process.env.NOVU_APP_ID as string,
    NOVU_BACKEND_URL: process.env.NOVU_BACKEND_URL as string,
    NOVU_SOCKET_URL: process.env.NOVU_SOCKET_URL as string,
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
