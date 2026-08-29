<template lang="pug">
.breable-text(v-if='isLoaded')
  router-view

  //- Глобальные оверлеи рендерятся ОБОБЩЁННО из универсального реестра-фабрики:
  //- платформенные регистрируются в registerCoreOverlays, оверлеи расширений —
  //- в их install.ts. App не импортирует конкретные оверлеи (тем более виджеты
  //- расширений).
  component(v-for='o in globalOverlays', :key='o.id', :is='o.component')
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api/alerts';
import { getGlobalOverlays } from 'src/shared/lib/overlays';
import { startRealtimeChannel } from 'src/shared/lib/realtime';
import { registerCoreOverlays } from 'src/app/providers/global-overlays';
import { registerCoreRealtimeSubscriptions } from 'src/app/providers/core-realtime';
import { useNotificationPermissionDialog } from 'src/features/NotificationPermissionDialog';
import { useSystemStore } from 'src/entities/System/model';
import { useDesktopHealthWatcherProcess } from 'src/processes/watch-desktop-health';
import { useSessionStore } from 'src/entities/Session';
import { initOpenReplayTracker } from 'src/shared/config';
// Start tracker
const session = useSessionStore();
const system = useSystemStore();

const { info } = system;

const isLoaded = ref(false);

// Платформенные глобальные оверлеи кладём в универсальный реестр; оверлеи
// расширений добавляются в их install.ts. App рендерит реестр обобщённо.
registerCoreOverlays();
const globalOverlays = getGlobalOverlays();

// Универсальный realtime-канал ядра: открывает подписки расширений по факту
// авторизации, дёргает catch-up на возврат активности. Подписки расширения
// регистрируют сами в своих install.ts (фабрика, как и оверлеи).
registerCoreRealtimeSubscriptions();
startRealtimeChannel();

// [BOOTRACE] таймстемп первого холодного старта (грепается по слову BOOTRACE).
const bootraceTs = (): string => {
  try {
    return `${Math.round(performance.now())}ms`;
  } catch {
    return '?';
  }
};

// Диалог разрешения уведомлений
const { showDialog } = useNotificationPermissionDialog();

onMounted(async () => {
  console.log(`[BOOTRACE] ${bootraceTs()} App.onMounted старт`);
  const SAFETY_REMOVE_LOADER_MS = 60_000;
  let safetyTimerId: ReturnType<typeof setTimeout> | undefined;
  if (typeof window !== 'undefined') {
    safetyTimerId = setTimeout(() => {
      if (!isLoaded.value) {
        console.warn(
          `[BOOTRACE] ${bootraceTs()} SAFETY-TIMEOUT 60s: boot/инициализация зависли, снимаем лоадер принудительно`,
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

    // Адрес страницы к этому моменту уже приведён к режиму роутера — конвертер
    // ссылок живёт в src/app/providers/router.ts (normalizeEntryUrl), до создания
    // роутера. Здесь, после первой навигации, чинить URL поздно.

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
    console.log(`[BOOTRACE] ${bootraceTs()} App.isLoaded=true (лоадер снят, router-view рендерится)`);
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
