import { ref } from 'vue';
import type { Queries } from '@coopenomics/sdk';
import { cancelProviderApp, loadProviderApps, subscribeProviderApp } from '../api';

export type ProviderApp =
  Queries.System.GetProviderApps.IOutput[typeof Queries.System.GetProviderApps.name][number];

// Состояние модуля: список читают карточка приложений и её диалоги.
const apps = ref<ProviderApp[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

/**
 * Приложения каталога на столе подключения (487-34): предложения провайдера
 * и подписки кооператива на них. Подписка — строка общего счёта кооператива,
 * поэтому после действия перечитываются и подписки провайдера.
 */
export function useProviderApps() {
  async function load(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      apps.value = await loadProviderApps();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading.value = false;
    }
  }

  function replace(app: ProviderApp): void {
    apps.value = apps.value.map((a) => (a.package_id === app.package_id ? app : a));
  }

  async function subscribe(packageId: string): Promise<ProviderApp> {
    const app = await subscribeProviderApp({ package_id: packageId });
    replace(app);
    return app;
  }

  async function cancel(packageId: string): Promise<ProviderApp> {
    const app = await cancelProviderApp({ package_id: packageId });
    replace(app);
    return app;
  }

  return { apps, isLoading, error, load, subscribe, cancel };
}
