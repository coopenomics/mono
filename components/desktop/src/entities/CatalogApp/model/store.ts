import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { Queries, Zeus } from '@coopenomics/sdk';
import { api } from 'src/entities/Extension/api';
import { useNetworkMode } from 'src/entities/System/model';

export type CatalogApp = Queries.Extensions.AppsCatalogRemotePackages.IOutput[
  typeof Queries.Extensions.AppsCatalogRemotePackages.name
][number];

export type CatalogAppSubscription = NonNullable<CatalogApp['subscription']>;

/** Права ядра приложения на узле: что просит версия, что разрешено, что ждёт согласия. */
export type CatalogAppRights = Queries.Extensions.CatalogAppRights.IOutput[
  typeof Queries.Extensions.CatalogAppRights.name
];

/** Набор прав ядра: порты и действия цепи. */
export interface CatalogAppRightsSet {
  ports: string[];
  chainActions: string[];
}

const NO_RIGHTS: CatalogAppRightsSet = { ports: [], chainActions: [] };

/**
 * Права, на которые председатель ещё не ответил: то, что просит действующая
 * версия, сверх согласованного. Перечень версии недоступен — берётся запрос,
 * который записало ядро при отказе в ключе.
 */
export function neededRights(rights: CatalogAppRights | undefined): CatalogAppRightsSet {
  if (!rights) return NO_RIGHTS;
  const want = rights.requested ?? rights.pending ?? NO_RIGHTS;
  return {
    ports: want.ports.filter((port) => !rights.granted.ports.includes(port)),
    chainActions: want.chainActions.filter((action) => !rights.granted.chainActions.includes(action)),
  };
}

/** Приложение ждёт согласия председателя на права ядра. */
export const awaitsConsent = (rights: CatalogAppRights | undefined): boolean => {
  const needed = neededRights(rights);
  return needed.ports.length + needed.chainActions.length > 0;
};

/** Имя приложения каталога в маршруте: пакет `@scope/name` приходит как есть. */
export const isCatalogAppName = (name: unknown): boolean => typeof name === 'string' && name.startsWith('@');

/** Подписка действует: приложение доступно кооперативу. */
export const isLiveSubscription = (s: CatalogAppSubscription | null | undefined): boolean =>
  !!s && (s.status === Zeus.ProviderAppSubscriptionStatus.ACTIVE || s.status === Zeus.ProviderAppSubscriptionStatus.TRIAL);

/**
 * Подписка ждёт первого списания: оплата вперёд (28.11.2026), срок оплаты у
 * провайдера стоит в моменте старта, пока хаб оператора не спишет первый
 * месяц. Пробная подписка первого списания не ждёт.
 */
export const awaitsFirstPayment = (s: CatalogAppSubscription | null | undefined): boolean =>
  !!s && !s.isTrial && new Date(s.expiresAt).getTime() <= new Date(s.startedAt).getTime();

/**
 * Права ядра приложений по пакету: страница приложения и ход установки читают
 * одно состояние. После согласия и переключателя витрина перечитывается:
 * пометка «Ждёт согласия» меняется вместе с правами.
 */
function useRightsState(reloadApps: () => Promise<void>) {
  const rights = ref<Record<string, CatalogAppRights>>({});

  function rightsOf(packageId: string): CatalogAppRights | undefined {
    return rights.value[packageId];
  }

  async function loadRights(packageId: string): Promise<void> {
    rights.value = { ...rights.value, [packageId]: await api.loadCatalogAppRights(packageId) };
  }

  /** Председатель согласился с правами: ядро выдаёт ключ, узел ставит версию ближайшим опросом. */
  async function grantRights(packageId: string, set: CatalogAppRightsSet): Promise<void> {
    const fresh = await api.grantCatalogAppRights({ packageId, ports: set.ports, chainActions: set.chainActions });
    rights.value = { ...rights.value, [packageId]: fresh };
    await reloadApps();
  }

  async function setRightsAutoAccept(packageId: string, enabled: boolean): Promise<void> {
    const fresh = await api.setCatalogAppRightsAutoAccept({ packageId, enabled });
    rights.value = { ...rights.value, [packageId]: fresh };
    await reloadApps();
  }

  return { rightsOf, loadRights, grantRights, setRightsAutoAccept };
}

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

  // Одиночный запуск: оператора и провайдера подключения нет — каталога
  // приложений у узла нет, доступны встроенные приложения. Запрос к узлу не
  // делается: он ответил бы отказом «цены недоступны» (28.11.2026).
  const { isNetworked } = useNetworkMode();

  async function load(): Promise<void> {
    if (!isNetworked.value) {
      apps.value = [];
      error.value = null;
      loaded.value = true;
      return;
    }
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

  const { rightsOf, loadRights, grantRights, setRightsAutoAccept } = useRightsState(load);

  return {
    apps,
    loading,
    loaded,
    error,
    load,
    find,
    subscribe,
    unsubscribe,
    setEnabled,
    rightsOf,
    loadRights,
    grantRights,
    setRightsAutoAccept,
  };
});
