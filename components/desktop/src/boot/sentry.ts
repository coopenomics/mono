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
      // Обрыв связи и таймаут запроса — не ошибка кабинета, а состояние сети:
      // во время обновления узла бэкенд недоступен минуту-другую, и пайщик в это
      // время видит заглушку «Техническое обслуживание» или «Синхронизация».
      // Такие события составляли почти весь журнал браузера и прятали настоящие
      // ошибки. Шаблоны закреплены целиком, а не подстрокой: «Failed to fetch
      // dynamically imported module» — это рассинхрон кусков сборки после
      // выкатки, и его видеть нужно.
      ignoreErrors: [
        /^(TypeError: )?Failed to fetch$/,
        /^(TypeError: )?Load failed$/,
        /^(TypeError: )?NetworkError when attempting to fetch resource\.?$/,
        /^(Error: )?(AbortError: )?(Fetch is aborted|signal is aborted without reason|The user aborted a request\.)$/,
        // Тот же обрыв, но узел за прокси уже отвечает страницей nginx: SDK
        // отдаёт её текстом ошибки GraphQLResponseError со статусом 502/503/504.
        /^(GraphQLResponseError: )?(HTTP 50[234]$|50[234] (Bad Gateway|Service (Temporarily )?Unavailable|Gateway Time-?out)\b)/i,
        // Отложенные обработчики Milkdown (debounce в его плагинах) срабатывают
        // после уничтожения редактора и не отменяются самой библиотекой —
        // пайщик при этом ничего не теряет: редактор уже закрыт.
        /Context "editorView" not found/,
        // Виджет поддержки не загрузился за 30 секунд (обычно его режет
        // блокировщик рекламы), и библиотека виджета отклоняет свой же промис
        // без перехвата. Кабинет от этого не страдает.
        /^(Error: )?Chatwoot not loaded$/,
      ],
    });
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    return; // Выходим из функции, не блокируем загрузку приложения
  }
});
