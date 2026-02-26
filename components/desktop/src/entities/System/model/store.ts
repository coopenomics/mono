import { defineStore } from 'pinia';
import { ref, Ref, triggerRef, computed, ComputedRef } from 'vue';
import { api } from '../api';
import type { ISystemInfo } from '../types';
import { Zeus } from '@coopenomics/sdk';
import { createClient } from 'graphql-ws';
import { env } from 'src/shared/config';

const namespace = 'systemStore';

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

  let isLoading = false;
  let wsUnsubscribe: (() => void) | null = null;

  const loadSystemInfo = async () => {
    if (isLoading) return;

    isLoading = true;
    try {
      info.value = await api.loadSystemInfo();
      backendAvailable.value = true;
      triggerRef(info);
    } catch (error) {
      console.warn('Failed to load system info:', error);
      backendAvailable.value = false;
      info.value.system_status = Zeus.SystemStatus.maintenance;
      throw error;
    } finally {
      isLoading = false;
    }
  };

  const startSystemMonitoring = () => {
    if (typeof window === 'undefined') return;
    stopSystemMonitoring();

    try {
      const wsUrl = (env.BACKEND_URL + '/v1/graphql').replace(/^http/, 'ws');

      const wsClient = createClient({
        url: wsUrl,
        connectionParams: () => {
          try {
            const globalStore = (window as any).__pinia?.state?.value?.global;
            const token = globalStore?.tokens?.access?.token;
            return token ? { token } : {};
          } catch {
            return {};
          }
        },
        retryAttempts: Infinity,
        shouldRetry: () => true,
        retryWait: async (retries) => {
          const delay = Math.min(1000 * Math.pow(2, retries), 60000);
          await new Promise(resolve => setTimeout(resolve, delay));
        },
        on: {
          connected: () => {
            if (!backendAvailable.value) {
              backendAvailable.value = true;
              loadSystemInfo().catch(() => {});
            }
          },
          closed: () => {
            backendAvailable.value = false;
            info.value.system_status = Zeus.SystemStatus.maintenance;
            maintenanceCounter.value++;
          },
        },
      });

      wsUnsubscribe = wsClient.subscribe(
        { query: 'subscription { systemStatusChanged { status message } }' },
        {
          next(value) {
            if (value.data) {
              backendAvailable.value = true;
              loadSystemInfo().catch(() => {});
            }
          },
          error() {
            backendAvailable.value = false;
            info.value.system_status = Zeus.SystemStatus.maintenance;
            maintenanceCounter.value++;
          },
          complete() {},
        },
      );
    } catch (e) {
      console.warn('Failed to start system monitoring subscription:', e);
    }
  };

  const stopSystemMonitoring = () => {
    if (wsUnsubscribe) {
      wsUnsubscribe();
      wsUnsubscribe = null;
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
