import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { Queries, Zeus } from '@coopenomics/sdk';
import { api } from 'src/entities/Extension/api';

export type CatalogApp = Queries.Extensions.AppsCatalogRemotePackages.IOutput[
  typeof Queries.Extensions.AppsCatalogRemotePackages.name
][number];

export type CatalogAppSubscription = NonNullable<CatalogApp['subscription']>;

/** Имя приложения каталога в маршруте: пакет `@scope/name` приходит как есть. */
export const isCatalogAppName = (name: unknown): boolean => typeof name === 'string' && name.startsWith('@');

/** Подписка действует: приложение доступно кооперативу. */
export const isLiveSubscription = (s: CatalogAppSubscription | null | undefined): boolean =>
  !!s && (s.status === Zeus.ProviderAppSubscriptionStatus.ACTIVE || s.status === Zeus.ProviderAppSubscriptionStatus.TRIAL);

/**
 * Приложения каталога на этом узле: цена и пробный срок у провайдера,
 * подписка кооператива, получен ли фронт и включено ли приложение.
 * Один список читают витрина, страница приложения и список установленных.
 */
export const useCatalogAppStore = defineStore('catalogAppStore', () => {
  const apps = ref<CatalogApp[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      apps.value = await api.loadAppsCatalogRemotePackages(1, 50);
      loaded.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      apps.value = [];
    } finally {
      loading.value = false;
    }
  }

  const byName = computed(() => new Map(apps.value.map((a) => [a.packageId, a])));

  function find(packageId: string): CatalogApp | undefined {
    return byName.value.get(packageId);
  }

  async function subscribe(packageId: string) {
    const result = await api.subscribePackage({ packageId });
    await load();
    return result;
  }

  async function unsubscribe(packageId: string) {
    const result = await api.unsubscribePackage({ packageId });
    await load();
    return result;
  }

  async function setEnabled(packageId: string, enabled: boolean): Promise<void> {
    await api.setCatalogAppEnabled({ packageId, enabled });
    await load();
  }

  return { apps, loading, loaded, error, load, find, subscribe, unsubscribe, setEnabled };
});
