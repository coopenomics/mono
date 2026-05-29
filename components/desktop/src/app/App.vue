<template lang="pug">
.breable-text(v-if='isLoaded')
  router-view

  RequireAgreements
  SelectBranchOverlay
  NotificationPermissionDialog
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api/alerts';
import { RequireAgreements } from 'src/widgets/RequireAgreements';
import { SelectBranchOverlay } from 'src/features/Branch/SelectBranch';
import {
  NotificationPermissionDialog,
  useNotificationPermissionDialog,
} from 'src/features/NotificationPermissionDialog';
import { useSystemStore } from 'src/entities/System/model';
import { useDesktopHealthWatcherProcess } from 'src/processes/watch-desktop-health';
import { useSessionStore } from 'src/entities/Session';
import { env, initOpenReplayTracker } from 'src/shared/config';
// Start tracker
const session = useSessionStore();
const system = useSystemStore();

const { info } = system;

const isLoaded = ref(false);

// Диалог разрешения уведомлений
const { showDialog } = useNotificationPermissionDialog();

onMounted(async () => {
  const SAFETY_REMOVE_LOADER_MS = 60_000;
  let safetyTimerId: ReturnType<typeof setTimeout> | undefined;
  if (typeof window !== 'undefined') {
    safetyTimerId = setTimeout(() => {
      if (!isLoaded.value) {
        console.warn(
          'Экран загрузки снят по таймауту: boot или инициализация зависли дольше ожидаемого.',
        );
        removeLoader();
        isLoaded.value = true;
      }
    }, SAFETY_REMOVE_LOADER_MS);
  }
  const clearSafetyTimer = () => {
    if (safetyTimerId !== undefined) {
      clearTimeout(safetyTimerId);
      safetyTimerId = undefined;
    }
  };

  try {
    console.log('systemInfo', info);

    // Нормализация URL под режим роутера (см. src/app/providers/router.ts):
    // — history (типичный SSR в проде): маршрут в pathname, без #. Старые ссылки вида /#/... переносим в path.
    // — hash (типичный SPA dev): маршрут после #; если путь оказался в pathname — переносим в hash.
    const hasWindow = typeof window !== 'undefined';
    const isClientBundle = process.env.CLIENT === 'true' || hasWindow;
    const isNotSsrRuntime = process.env.SERVER !== 'true';
    const routerMode = env.VUE_ROUTER_MODE || process.env.VUE_ROUTER_MODE || 'hash';

    if (hasWindow && isClientBundle && isNotSsrRuntime) {
      if (routerMode === 'history') {
        const rawHash = window.location.hash;
        if (rawHash.length > 1 && rawHash.startsWith('#/')) {
          let inner = rawHash.slice(1);
          if (!inner.startsWith('/')) {
            inner = `/${inner}`;
          }
          const current = window.location.pathname + window.location.search;
          const pathOnly = window.location.pathname;
          if (inner === current) {
            window.history.replaceState(window.history.state, '', current);
          } else if (pathOnly === '/' || pathOnly === '' || pathOnly === '/index.html') {
            window.location.replace(window.location.origin + inner);
            clearSafetyTimer();
            return;
          }
        }
      } else if (routerMode === 'hash') {
        const shouldCorrectHashUrl =
          window.location.pathname !== '/' &&
          window.location.pathname !== '/index.html' &&
          (!window.location.hash ||
            !window.location.hash.includes(window.location.pathname));

        if (shouldCorrectHashUrl) {
          const newUrl =
            window.location.origin +
            '/#' +
            window.location.pathname +
            window.location.search;
          window.location.replace(newUrl);
          clearSafetyTimer();
          return;
        }
      }
    }

    // Запускаем процесс мониторинга "технического обслуживания" после монтирования
    useDesktopHealthWatcherProcess();

    // OpenReplay tracker initialization (only for client production)
    initOpenReplayTracker({
      username: session.username,
      coopname: system.info.coopname,
      cooperativeDisplayName: system.cooperativeDisplayName,
    });

    removeLoader();
    isLoaded.value = true;
    clearSafetyTimer();

    // Показываем диалог разрешения уведомлений после загрузки
    setTimeout(() => {
      showDialog();
    }, 1000);
  } catch (e) {
    console.error(e);
    FailAlert(e);
    isLoaded.value = true;
    removeLoader();
    clearSafetyTimer();
  }
});

onUnmounted(() => {
  // Останавливаем мониторинг системной информации при размонтировании
  system.stopSystemMonitoring();
});

function removeLoader() {
  const loaderContainer = document.querySelector('.loader-container');
  if (loaderContainer) {
    loaderContainer.remove();
  } else {
    FailAlert('Возникла ошибка при загрузке сайта :(');
  }
}
</script>
<style>
.q-loading__backdrop {
  /* стиль полного оверлея технического обслуживания */
  opacity: 1 !important;
}
</style>
