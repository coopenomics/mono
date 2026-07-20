// src/router/index.js
import { route } from 'quasar/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';
import { routes } from 'src/app/providers/routes';
import { env } from 'src/shared/config';

// Helper function to determine router history mode
function getHistoryMode() {
  if (env.SERVER) return createMemoryHistory;
  return env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory;
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
  const Router = createRouter({
    history: getHistoryMode()(env.VUE_ROUTER_BASE),
    routes, // Базовые маршруты
    scrollBehavior(to, from, savedPosition) {
      return savedPosition || { top: 0 };
    },
  });

  // [FIX-1] Авто-восстановление при провале загрузки ленивого чанка маршрута.
  // На первом холодном заходе в проде import() компонента маршрута может упасть
  // (сетевая латентность + фоновой precache-шторм только что установленного SW).
  // Без этого обработчика Vue Router молча гасит навигацию → router-view пустой →
  // белый экран до ручной перезагрузки. Здесь превращаем провал в авто-reload на
  // целевой путь (тёплый кэш SW отдаёт чанки мгновенно — повтор проходит).
  if (typeof window !== 'undefined') {
    Router.onError((err: unknown, to) => {
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

      if (isChunkError) {
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
            `[BOOTRACE] ${bootraceTs()} chunk-load failed → авто-reload на ${to?.fullPath ?? 'текущий'}`,
          );
          if (to?.fullPath) window.location.assign(to.fullPath);
          else window.location.reload();
        } else {
          console.error(
            `[BOOTRACE] ${bootraceTs()} chunk-load снова упал после reload — НЕ зацикливаемся`,
          );
        }
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
      console.log(
        `[BOOTRACE] ${bootraceTs()} afterEach установлен маршрут ${to.fullPath} (name=${String(to.name ?? '∅')})`,
      );
    });
  }

  return Router;
});
