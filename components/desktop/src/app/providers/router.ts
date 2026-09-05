// src/router/index.js
import { route } from 'quasar/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
  START_LOCATION,
} from 'vue-router';
import { routes } from 'src/app/providers/routes';
import { env } from 'src/shared/config';
import { normalizeEntryUrl, resolveRouterMode } from 'src/shared/lib/navigation';
import { ConnectionLostAlert } from 'src/shared/api/alerts';

// Helper function to determine router history mode
function getHistoryMode() {
  if (env.SERVER) return createMemoryHistory;
  return resolveRouterMode() === 'history' ? createWebHistory : createWebHashHistory;
}

// Диагностический логгер первого холодного старта. Грепается по слову BOOTRACE.
// performance.now() — мс от старта документа; позволяет восстановить порядок гонки
// «загрузка столов ↔ регистрация маршрутов ↔ навигация гарда ↔ догрузка чанка».
function bootraceTs(): string {
  try {
    return `${Math.round(performance.now())}ms`;
  } catch {
    return '?';
  }
}

// Main route export
export default route(function () {
  // Конвертер ссылок платформы: адрес приводится к режиму роутера ДО того, как
  // роутер прочитает location. Раньше это жило в App.onMounted — то есть после
  // первой навигации: на ссылке вида `/#/coop/capital/…` history-роутер успевал
  // сматчить `/`, гард навигации уводил на дефолтный стол, и починить адрес было
  // уже нечем (pathname больше не корневой). Отсюда «ссылка с решёткой открывает
  // чужой стол» при рабочей ссылке без решётки.
  normalizeEntryUrl();

  const Router = createRouter({
    history: getHistoryMode()(env.VUE_ROUTER_BASE),
    routes, // Базовые маршруты
    scrollBehavior(to, from, savedPosition) {
      return savedPosition || { top: 0 };
    },
  });

  // Провал загрузки ленивого куска кода страницы: обрыв связи, перезапуск стенда,
  // выкладка новой сборки (старые куски исчезли с сервера). Два разных случая:
  // - первая навигация — приложение ещё не отрисовано, без reload останется белый
  //   экран; перезагружаемся на целевой путь (тёплый кэш SW отдаёт куски мгновенно),
  //   с защитой от цикла через sessionStorage;
  // - приложение уже работает — НЕ перезагружаемся. Reload посреди обрыва запускал
  //   холодный старт без связи: рабочий стол приезжал гостевым, и гвард уводил на
  //   «Недостаточно прав доступа». Остаёмся на месте, повторяем переход с паузами,
  //   после исчерпания попыток отдаём решение пользователю тостом.
  if (typeof window !== 'undefined') {
    const CHUNK_RETRY_DELAYS_MS = [2_000, 5_000, 10_000];
    let chunkRetry: {
      path: string;
      attempt: number;
      timer: ReturnType<typeof setTimeout> | null;
    } | null = null;

    const cancelChunkRetry = (): void => {
      if (chunkRetry?.timer) clearTimeout(chunkRetry.timer);
      chunkRetry = null;
    };

    const retryChunkLater = (path: string): void => {
      if (!chunkRetry || chunkRetry.path !== path) {
        cancelChunkRetry();
        chunkRetry = { path, attempt: 0, timer: null };
        ConnectionLostAlert();
      }
      const delay = CHUNK_RETRY_DELAYS_MS[chunkRetry.attempt];
      if (delay === undefined) {
        // Попытки исчерпаны — дальше решает пользователь.
        chunkRetry = null;
        ConnectionLostAlert(() => {
          void Router.push(path).catch(() => undefined);
        });
        return;
      }
      chunkRetry.attempt += 1;
      chunkRetry.timer = setTimeout(() => {
        if (chunkRetry) chunkRetry.timer = null;
        // Повторный провал снова придёт в onError и запланирует следующую попытку.
        void Router.push(path).catch(() => undefined);
      }, delay);
    };

    Router.onError((err: unknown, to, from) => {
      const message = (err as { message?: string })?.message ?? String(err);
      const isChunkError =
        /dynamically imported module|Importing a module|ChunkLoadError|Failed to fetch|error loading dynamically imported module/i.test(
          message,
        );

      console.error(`[BOOTRACE] ${bootraceTs()} router.onError`, {
        isChunkError,
        target: to?.fullPath,
        message,
      });

      if (!isChunkError) return;

      if (from !== START_LOCATION) {
        console.warn(
          `[BOOTRACE] ${bootraceTs()} chunk-load failed → остаёмся на ${from.fullPath}, повтор перехода на ${to?.fullPath ?? '∅'}`,
        );
        if (to?.fullPath) retryChunkLater(to.fullPath);
        return;
      }

      // Защита от бесконечного reload-цикла: помечаем попытку в sessionStorage,
      // чтобы при повторном провале на той же сессии не зациклиться.
      const guardKey = '__bootrace_chunk_reload__';
      let alreadyTried = false;
      try {
        alreadyTried = sessionStorage.getItem(guardKey) === to?.fullPath;
        if (!alreadyTried && to?.fullPath) {
          sessionStorage.setItem(guardKey, to.fullPath);
        }
      } catch {
        // sessionStorage недоступен (инкогнито с жёсткими настройками) — просто reload
      }

      if (!alreadyTried) {
        console.warn(
          `[BOOTRACE] ${bootraceTs()} chunk-load failed на первой навигации → авто-reload на ${to?.fullPath ?? 'текущий'}`,
        );
        if (to?.fullPath) window.location.assign(to.fullPath);
        else window.location.reload();
      } else {
        console.error(
          `[BOOTRACE] ${bootraceTs()} chunk-load снова упал после reload — НЕ зацикливаемся`,
        );
      }
    });

    // [BOOTRACE] Тайминг навигации — видно, когда гард стартует относительно
    // загрузки столов и успевают ли зарегистрироваться динамические маршруты.
    Router.beforeEach((to, from) => {
      const matched = to.matched.length;
      console.log(
        `[BOOTRACE] ${bootraceTs()} beforeEach ${from.fullPath ?? '∅'} → ${to.fullPath} (matched=${matched})`,
      );
      // Успешная навигация на сматченный путь — снимаем reload-guard.
      try {
        if (matched > 0) sessionStorage.removeItem('__bootrace_chunk_reload__');
      } catch {
        /* noop */
      }
    });

    Router.afterEach((to) => {
      // Переход, который повторяли после провала куска кода, прошёл — повтор снят.
      if (chunkRetry && to.fullPath === chunkRetry.path) cancelChunkRetry();
      console.log(
        `[BOOTRACE] ${bootraceTs()} afterEach установлен маршрут ${to.fullPath} (name=${String(to.name ?? '∅')})`,
      );
    });
  }

  return Router;
});
