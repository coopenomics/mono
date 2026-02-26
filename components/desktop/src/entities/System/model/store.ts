import { defineStore } from 'pinia';
import { ref, Ref, triggerRef, computed, ComputedRef } from 'vue';
import { api } from '../api';
import type { ISystemInfo } from '../types';
import { Zeus } from '@coopenomics/sdk';

const namespace = 'systemStore';

const BASE_INTERVAL_MS = 30000;
const MAX_INTERVAL_MS = 300000;
const BACKOFF_MULTIPLIER = 2;

interface ISystemStore {
  info: Ref<ISystemInfo>;
  backendAvailable: Ref<boolean>;
  maintenanceCounter: Ref<number>;
  loadSystemInfo: () => Promise<void>;
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
    system_status: 'active',
  } as ISystemInfo);
  const backendAvailable = ref<boolean>(true);
  const maintenanceCounter = ref<number>(0);

  let monitoringTimeout: ReturnType<typeof setTimeout> | null = null;
  let isLoading = false;
  let currentInterval = BASE_INTERVAL_MS;
  let consecutiveErrors = 0;

  const loadSystemInfo = async () => {
    if (isLoading) return;

    isLoading = true;
    try {
      info.value = await api.loadSystemInfo();
      backendAvailable.value = true;
      triggerRef(info);
      consecutiveErrors = 0;
      currentInterval = BASE_INTERVAL_MS;
    } catch (error) {
      console.warn('Failed to load system info:', error);
      backendAvailable.value = false;
      info.value.system_status = Zeus.SystemStatus.maintenance;
      consecutiveErrors++;
      currentInterval = Math.min(
        BASE_INTERVAL_MS * Math.pow(BACKOFF_MULTIPLIER, consecutiveErrors),
        MAX_INTERVAL_MS
      );
      throw error;
    } finally {
      isLoading = false;
    }
  };

  const scheduleNextCheck = () => {
    if (typeof window === 'undefined') return;
    stopSystemMonitoring();

    monitoringTimeout = setTimeout(async () => {
      try {
        await loadSystemInfo();
      } catch {
        backendAvailable.value = false;
        info.value.system_status = Zeus.SystemStatus.maintenance;
        maintenanceCounter.value++;
      }
      scheduleNextCheck();
    }, currentInterval);
  };

  const startSystemMonitoring = () => {
    if (typeof window === 'undefined') return;
    stopSystemMonitoring();
    consecutiveErrors = 0;
    currentInterval = BASE_INTERVAL_MS;
    scheduleNextCheck();
  };

  const stopSystemMonitoring = () => {
    if (monitoringTimeout) {
      clearTimeout(monitoringTimeout);
      monitoringTimeout = null;
    }
  };

  const cooperativeDisplayName = computed(() => {
    const vars = info.value?.vars;
    if (vars?.short_abbr && vars?.name) {
      return `${vars.short_abbr} ${vars.name}`;
    }
    return info.value.contacts?.full_name || '';
  });

  const governSymbol = computed(() => info.value.symbols?.root_govern_symbol || '₽');
  const governPrecision = computed(() => info.value.symbols?.root_govern_precision || 2);
  const systemSymbol = computed(() => info.value.symbols?.root_symbol || '₽');
  const systemPrecision = computed(() => info.value.symbols?.root_precision || 2);

  return {
    info,
    backendAvailable,
    maintenanceCounter,
    loadSystemInfo,
    startSystemMonitoring,
    stopSystemMonitoring,
    cooperativeDisplayName,
    governSymbol,
    governPrecision,
    systemSymbol,
    systemPrecision,
  };
});
