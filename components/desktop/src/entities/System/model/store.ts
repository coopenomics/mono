import { defineStore } from 'pinia';
import { ref, Ref, triggerRef, computed, ComputedRef } from 'vue';
import { api } from '../api';
import type { INodeSyncState, ISystemInfo } from '../types';
import { Zeus } from '@coopenomics/sdk';

const namespace = 'systemStore';

// Константы для экспоненциального backoff
const BASE_INTERVAL_MS = 30000; // Базовый интервал 30 секунд (было 10)
const MAX_INTERVAL_MS = 300000; // Максимальный интервал 5 минут
const BACKOFF_MULTIPLIER = 2; // Множитель для backoff
/**
 * Пока рабочий стол закрыт (узел молчит или догоняет цепь), состояние
 * проверяется часто и без backoff: пайщик сидит перед заглушкой и ждёт, а
 * восстановление иначе замечалось бы через полминуты и позже. Запрос дешёвый —
 * узел отдаёт уже посчитанное состояние, без обращения к базе и цепи.
 */
const BLOCKED_INTERVAL_MS = 3000;

interface ISystemStore {
  info: Ref<ISystemInfo>;
  backendAvailable: Ref<boolean>;
  maintenanceCounter: Ref<number>;
  syncState: Ref<INodeSyncState | null>;
  loadSystemInfo: () => Promise<void>;
  loadNodeSyncState: () => Promise<void>;
  startSystemMonitoring: () => void;
  stopSystemMonitoring: () => void;
  cooperativeDisplayName: ComputedRef<string>;
  governSymbol: ComputedRef<string>;
  governPrecision: ComputedRef<number>;
  systemSymbol: ComputedRef<string>;
  systemPrecision: ComputedRef<number>;
}

export const useSystemStore = defineStore(namespace, (): ISystemStore => {
  const info = ref<ISystemInfo>({
    system_status: 'active', // Начальное значение
  } as ISystemInfo);
  const backendAvailable = ref<boolean>(true);
  const maintenanceCounter = ref<number>(0); // Счетчик для принудительного обновления
  // null — состояние узла ещё не известно. Заглушку по нему не показываем:
  // иначе рабочий стол моргал бы ей на каждой холодной загрузке.
  const syncState = ref<INodeSyncState | null>(null);

  let monitoringTimeout: ReturnType<typeof setTimeout> | null = null;
  let syncTimeout: ReturnType<typeof setTimeout> | null = null;
  let isLoading = false; // Защита от конкурентных запросов
  let currentInterval = BASE_INTERVAL_MS; // Текущий интервал (для backoff)
  let consecutiveErrors = 0; // Счетчик последовательных ошибок

  const loadSystemInfo = async () => {
    // Защита от конкурентных запросов
    if (isLoading) {
      console.debug('loadSystemInfo: запрос уже выполняется, пропускаем');
      return;
    }

    isLoading = true;
    try {
      info.value = await api.loadSystemInfo();
      backendAvailable.value = true;
      triggerRef(info); // Принудительно триггерим реактивность

      // При успехе сбрасываем backoff
      consecutiveErrors = 0;
      currentInterval = BASE_INTERVAL_MS;
    } catch (error) {
      console.warn('Failed to load system info, backend might be unavailable:', error);
      backendAvailable.value = false;
      // При недоступности бэкенда устанавливаем статус обслуживания
      info.value.system_status = Zeus.SystemStatus.maintenance;

      // Увеличиваем интервал при ошибках (экспоненциальный backoff)
      consecutiveErrors++;
      currentInterval = Math.min(
        BASE_INTERVAL_MS * Math.pow(BACKOFF_MULTIPLIER, consecutiveErrors),
        MAX_INTERVAL_MS
      );
      console.debug(`Backoff: следующая попытка через ${currentInterval / 1000} секунд`);

      throw error; // Перебрасываем ошибку для обработки выше
    } finally {
      isLoading = false;
    }
  };

  /**
   * Дочитка состояния узла. Основной канал — подписка; запрос нужен на первую
   * отрисовку и как страховка, когда сокет оборван. Недоступный узел — это и
   * есть «связи нет», поэтому ошибка запроса не глотается, а становится
   * состоянием.
   */
  const loadNodeSyncState = async () => {
    try {
      syncState.value = await api.loadNodeSyncState();
    } catch (error) {
      console.warn('Не удалось получить состояние синхронизации узла:', error);
      syncState.value = {
        ...(syncState.value ?? {}),
        status: Zeus.NodeSyncStatus.DISCONNECTED,
        outage: Zeus.NodeSyncOutage.NODE,
      } as INodeSyncState;
    }
  };

  const scheduleNextCheck = () => {
    // КРИТИЧНО: Не запускаем мониторинг на сервере (SSR)
    // В SSR setInterval/setTimeout создают утечки памяти и накапливают запросы
    if (typeof window === 'undefined') {
      return;
    }

    // Гасим только свой таймер: цикл состояния узла идёт своим темпом.
    stopInfoMonitoring();

    monitoringTimeout = setTimeout(async () => {
      try {
        await loadSystemInfo();
      } catch (error) {
        console.warn('Failed to update system info during monitoring:', error);
        // При недоступности бэкенда устанавливаем статус обслуживания
        backendAvailable.value = false;
        info.value.system_status = Zeus.SystemStatus.maintenance;
        maintenanceCounter.value++; // Увеличиваем счетчик для триггера watch
      }

      // Планируем следующую проверку с учетом возможного backoff
      scheduleNextCheck();
    }, currentInterval);
  };

  /**
   * Отдельный цикл для состояния узла — он идёт своим темпом, а не темпом
   * тяжёлой сводки о системе. Пока рабочий стол закрыт, узел опрашивается
   * часто: это единственный способ заметить, что он вернулся, когда сокет
   * оборван (подписка живёт только при живом бэкенде).
   */
  const scheduleNextSyncCheck = () => {
    if (typeof window === 'undefined') return;

    stopSyncMonitoring();

    const blocked = syncState.value !== null && syncState.value.status !== Zeus.NodeSyncStatus.SYNCED;
    syncTimeout = setTimeout(async () => {
      await loadNodeSyncState();
      scheduleNextSyncCheck();
    }, blocked ? BLOCKED_INTERVAL_MS : BASE_INTERVAL_MS);
  };

  const stopSyncMonitoring = () => {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }
  };

  const stopInfoMonitoring = () => {
    if (monitoringTimeout) {
      clearTimeout(monitoringTimeout);
      monitoringTimeout = null;
    }
  };

  const startSystemMonitoring = () => {
    // КРИТИЧНО: Не запускаем мониторинг на сервере (SSR)
    // Это предотвращает утечку таймеров и самоDDoS
    if (typeof window === 'undefined') {
      console.debug('startSystemMonitoring: пропускаем на сервере (SSR)');
      return;
    }

    // Останавливаем существующий мониторинг, если он есть
    stopSystemMonitoring();

    // Сбрасываем backoff при явном старте мониторинга
    consecutiveErrors = 0;
    currentInterval = BASE_INTERVAL_MS;

    // Используем setTimeout вместо setInterval для гибкого управления интервалом
    scheduleNextCheck();
    scheduleNextSyncCheck();
  };

  const stopSystemMonitoring = () => {
    stopInfoMonitoring();
    stopSyncMonitoring();
  };

  // Человеко-читаемое название кооператива
  const cooperativeDisplayName = computed(() => {
    const vars = info.value?.vars;
    if (vars?.short_abbr && vars?.name) {
      return `${vars.short_abbr} ${vars.name}`;
    }
    return info.value.contacts?.full_name || '';
  });

  // Символ управления (govern)
  const governSymbol = computed(() => info.value.symbols?.root_govern_symbol || '₽');

  // Точность символа управления
  const governPrecision = computed(() => info.value.symbols?.root_govern_precision || 2);

  // Системный символ
  const systemSymbol = computed(() => info.value.symbols?.root_symbol || '₽');

  // Точность системного символа
  const systemPrecision = computed(() => info.value.symbols?.root_precision || 2);

  return {
    info,
    backendAvailable,
    maintenanceCounter,
    syncState,
    loadSystemInfo,
    loadNodeSyncState,
    startSystemMonitoring,
    stopSystemMonitoring,
    cooperativeDisplayName,
    governSymbol,
    governPrecision,
    systemSymbol,
    systemPrecision,
  };
});
