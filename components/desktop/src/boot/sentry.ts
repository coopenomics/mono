import { boot } from 'quasar/wrappers';
import * as Sentry from '@sentry/vue';
import { env } from 'src/shared/config';

export default boot(({ app, router }) => {
  // Sentry (@sentry/vue + browserTracing) — браузерный SDK, работает только на клиенте.
  // В SSR boot-файлы выполняются на КАЖДЫЙ рендер-запрос, поэтому Sentry.init здесь
  // на каждом запросе плодил новый клиент/интеграции (утечка памяти → «пила» RAM)
  // и спамил лог сервера строкой про инициализацию. На сервере Sentry не нужен.
  if (process.env.SERVER) {
    return;
  }

  // Инициализируем Sentry только если есть DSN
  if (!env.SENTRY_DSN) {
    console.warn('SENTRY_DSN не настроен, Sentry не инициализирован');
    return;
  }

  try {
    Sentry.init({
      app,
      dsn: env.SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration({ router }),
      ],
      tracesSampleRate: 0.01,
      environment: env.NODE_ENV || 'development',
    });
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    return; // Выходим из функции, не блокируем загрузку приложения
  }
});
