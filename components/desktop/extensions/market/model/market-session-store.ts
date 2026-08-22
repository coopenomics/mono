import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useSessionStore } from 'src/entities/Session';

// Pinia-store расширения «Стол заказов». Отделён от core-session: ядро
// не должно знать про marketplace-роли (orderer/offerer/operator/
// board_readonly/board/admin), это policy самого расширения. Хранилище
// заполняется только по запросу — например, при попытке войти на
// защищённый маршрут `/market-pvz/*` через `beforeEnter` в install.ts.
//
// Reset при логауте — через watch на session.isAuth и session.username:
// composition-setup выполняется один раз при первом useMarketSessionStore(),
// watch'и живут до выгрузки страницы и автоматически сбрасывают стор при
// session.close() или смене пайщика.

interface IMarketplaceWhoAmI {
  username?: string;
  core_roles?: string[];
  marketplace_roles?: string[];
}

export const useMarketSessionStore = defineStore('market-session', () => {
  const session = useSessionStore();

  const marketplaceRoles = ref<string[]>([]);
  const coreRoles = ref<string[]>([]);
  const username = ref<string | null>(null);
  const loaded = ref(false);
  const inflight = ref<Promise<void> | null>(null);

  function reset(): void {
    marketplaceRoles.value = [];
    coreRoles.value = [];
    username.value = null;
    loaded.value = false;
    inflight.value = null;
  }

  async function fetchRoles(force = false): Promise<void> {
    if (!session.isAuth) {
      reset();
      return;
    }
    if (loaded.value && !force) return;
    if (inflight.value) {
      await inflight.value;
      return;
    }

    const task = (async () => {
      try {
        const res = (await client.Query(
          Queries.Marketplace.WhoAmI.query,
          { variables: {} },
        )) as Record<string, unknown>;
        const data = res?.[Queries.Marketplace.WhoAmI.name] as
          | IMarketplaceWhoAmI
          | undefined;
        username.value = data?.username ?? null;
        coreRoles.value = data?.core_roles ?? [];
        marketplaceRoles.value = data?.marketplace_roles ?? [];
        loaded.value = true;
      } catch (err) {
        console.warn('[market-session] marketplaceWhoAmI failed:', err);
        marketplaceRoles.value = [];
        coreRoles.value = [];
        username.value = null;
        loaded.value = false;
      } finally {
        inflight.value = null;
      }
    })();

    inflight.value = task;
    await task;
  }

  function hasRole(role: string): boolean {
    return marketplaceRoles.value.includes(role);
  }

  watch(
    () => session.isAuth,
    (isAuth) => {
      if (!isAuth) reset();
    },
  );

  watch(
    () => session.username,
    (next, prev) => {
      if (next !== prev) reset();
    },
  );

  return {
    marketplaceRoles,
    coreRoles,
    username,
    loaded,
    fetchRoles,
    hasRole,
    reset,
  };
});
