// processes/watch-desktop-health/index.ts
import { watch, computed } from 'vue';
import { QSpinnerGears, useQuasar } from 'quasar';
import { useSystemStore } from 'src/entities/System/model';
import { Zeus } from '@coopenomics/sdk';

/** Мастер установки не должен перекрываться заглушкой техобслуживания. */
function isOnInstallPage(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.hash || window.location.pathname;
  return path.includes('/install');
}

/** maintenance без сохранённых vars — прерванная установка, а не плановое обслуживание. */
function isIncompleteInstallMaintenance(systemStatus: string, hasSavedVars: boolean): boolean {
  return systemStatus === Zeus.SystemStatus.maintenance && !hasSavedVars;
}

/**
 * Техобслуживание закрывает рабочий стол лоадером. Отставание узла от цепи —
 * отдельное состояние со своим экраном (`NodeSyncOverlay`): там нужен ход
 * догона, а не бесконечный спиннер.
 */
export function useDesktopHealthWatcherProcess() {
  const $q = useQuasar();
  const systemStore = useSystemStore();


  // Создаем computed для лучшей реактивности
  const systemStatus = computed(() => systemStore.info.system_status);
  const hasSavedVars = computed(() => Boolean(systemStore.info.vars?.name));

  const enableLoading = () => {
    $q.loading.show({
      spinner: QSpinnerGears,
      message: 'Техническое обслуживание..',
      spinnerSize: 50,
    });
  };

  const disableLoading = () => {
    $q.loading.hide();
  };

  const check = () => {
    const blockedByMaintenance =
      systemStatus.value === Zeus.SystemStatus.maintenance &&
      !isIncompleteInstallMaintenance(systemStatus.value, hasSavedVars.value) &&
      !isOnInstallPage();

    if (blockedByMaintenance) {
      enableLoading();
    } else {
      disableLoading();
    }
  };

  // Первоначальная проверка
  check();

  // Выход из обслуживания снимает заглушку — и только. Раньше здесь стояла
  // перезагрузка страницы: рабочий стол уезжал в полную загрузку ради данных,
  // которые и так приезжают подпиской, а на dev-сборке это минута ожидания.
  watch(
    systemStatus,
    () => {
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
}
