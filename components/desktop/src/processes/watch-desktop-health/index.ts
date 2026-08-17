// processes/watch-desktop-health/index.ts
import { watch, computed } from 'vue';
import { QSpinnerGears, useQuasar } from 'quasar';
import { useSystemStore } from 'src/entities/System/model';
import { Zeus } from '@coopenomics/sdk';
import type { INodeSyncState } from 'src/entities/System/types';

/**
 * Страницы, которые заглушка перекрывать не должна: на них чинят сам узел.
 * Мастер установки — прерванная или новая установка, dev-страницы — служебные.
 */
function isOnServicePage(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.hash || window.location.pathname;
  return path.includes('/install') || path.includes('/_dev');
}

/** maintenance без сохранённых vars — прерванная установка, а не плановое обслуживание. */
function isIncompleteInstallMaintenance(systemStatus: string, hasSavedVars: boolean): boolean {
  return systemStatus === Zeus.SystemStatus.maintenance && !hasSavedVars;
}

/** «через 2 ч 15 мин» читается, «через 8100 с» — нет. */
function formatRemaining(seconds: number): string {
  if (seconds < 60) return 'меньше минуты';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `около ${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `около ${hours} ч ${restMinutes} мин` : `около ${hours} ч`;
}

/**
 * Заглушка объясняет пайщику, чего он ждёт, а не сообщает о поломке: узел жив и
 * читает цепь, просто данные ещё неполные.
 */
function syncMessage(state: INodeSyncState): string {
  if (state.status === Zeus.NodeSyncStatus.DISCONNECTED) {
    if (state.outage === Zeus.NodeSyncOutage.NODE) {
      return 'Нет связи с узлом кооператива.<br>Ждём восстановления связи..';
    }
    if (state.outage === Zeus.NodeSyncOutage.READER) {
      return 'Чтение блокчейна остановлено.<br>Ждём возобновления..';
    }
    return 'Блокчейн не отвечает.<br>Ждём восстановления связи..';
  }

  const lag = state.lag_blocks ?? 0;
  const eta = state.estimated_seconds_remaining;
  const lagLine = `Осталось ${lag.toLocaleString('ru-RU')} блоков`;
  const etaLine = eta ? ` · ${formatRemaining(eta)}` : '';
  return `Синхронизация с блокчейном..<br>${lagLine}${etaLine}`;
}

/**
 * Чем закрыт рабочий стол прямо сейчас, либо `null` — работать можно.
 *
 * Обслуживание и догон цепи — два разных состояния с общим следствием: пока
 * они длятся, работать нельзя. Заглушка одна, разнится только текст.
 */
function overlayMessage(
  systemStatus: string,
  hasSavedVars: boolean,
  syncState: INodeSyncState | null,
): string | null {
  if (isOnServicePage()) return null;

  if (
    systemStatus === Zeus.SystemStatus.maintenance &&
    !isIncompleteInstallMaintenance(systemStatus, hasSavedVars)
  ) {
    return 'Техническое обслуживание..';
  }

  // Узел вне синхронизации: данные в базе неполные, а запись выглядела бы
  // зависшей — операция уходит в цепь, а её подтверждение придёт лишь когда
  // узел дочитает цепь. Пока идёт догон, работать не даём.
  if (syncState && syncState.status !== Zeus.NodeSyncStatus.SYNCED) {
    return syncMessage(syncState);
  }

  return null;
}

export function useDesktopHealthWatcherProcess() {
  const $q = useQuasar();
  const systemStore = useSystemStore();


  // Создаем computed для лучшей реактивности
  const systemStatus = computed(() => systemStore.info.system_status);
  const hasSavedVars = computed(() => Boolean(systemStore.info.vars?.name));
  const syncState = computed(() => systemStore.syncState);

  const check = () => {
    const message = overlayMessage(systemStatus.value, hasSavedVars.value, syncState.value);
    if (message) {
      $q.loading.show({ spinner: QSpinnerGears, message, html: true, spinnerSize: 50 });
    } else {
      $q.loading.hide();
    }
  };

  // Первоначальная проверка
  check();

  watch(
    systemStatus,
    (newSystemStatus, oldSystemStatus) => {

      // Если состояние изменилось с maintenance на active (выход из технического обслуживания)
      if (
        oldSystemStatus === Zeus.SystemStatus.maintenance &&
        (newSystemStatus === Zeus.SystemStatus.active ||
          newSystemStatus === Zeus.SystemStatus.install)
      ) {
        // Перезагружаем страницу
        if (process.env.CLIENT) {
          window.location.reload();
        }
        return;
      }

      // Обычная логика проверки
      check();
    },
    {
      flush: 'sync', // Синхронное срабатывание для немедленной реакции
    },
  );

  // Дополнительная проверка через небольшую задержку на случай если статус изменился ДО регистрации watch
  setTimeout(() => {
    check();
  }, 100);

  // Следим за счетчиком maintenance для принудительной проверки
  watch(
    () => systemStore.maintenanceCounter,
    () => {
      check();
    },
  );

  // Ход догона: заглушка обязана обновлять остаток и сниматься сама, без
  // перезагрузки страницы. `deep` — состояние приходит новым объектом, но
  // меняются в нём только числа.
  watch(syncState, () => {
    check();
  }, { deep: true });
}
