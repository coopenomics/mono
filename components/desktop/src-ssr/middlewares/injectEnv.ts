import { ssrMiddleware } from 'quasar/wrappers';
import { createEnvObject } from '../../src/shared/config/createEnvObject';

/**
 * SSR middleware для инъекции переменных окружения в браузер
 * Создает window.__ENV__ со всеми переменными, которые должны быть доступны на клиенте
 */
export default ssrMiddleware(({ app }) => {
  // Регистрируем middleware для всех запросов
  app.use((req, res, next) => {
    // Получаем переменные из process.env, которые нужны клиенту
    const envForClient = createEnvObject();

    // Создаем скрипт, который добавит переменные в window.__ENV__
    const script = `
    <script>
      window.__ENV__ = ${JSON.stringify(envForClient)};
      console.log('SSR: Переменные окружения загружены');
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
});
