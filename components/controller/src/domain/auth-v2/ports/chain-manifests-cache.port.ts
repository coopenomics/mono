/**
 * Порт кэша манифестов цепи (CoopID, Story 4.5): свежий локальный снимок активных
 * публичных ключей аккаунтов COOPOS (`account → active_keys[]`). Наполняется на
 * каждом живом успешном входе; читается на degraded-фолбэке, когда живой узел
 * недоступен. Концептуальное зеркало клиентского `chain_manifests_cache` (Story 4.4).
 */

export interface AccountManifest {
  account: string;
  /** Активные публичные ключи аккаунта (формат как вернул COOPOS, `PUB_K1_…`/`EOS…`). */
  active_keys: string[];
  /** Время снятия снимка (ISO-8601 UTC). */
  cached_at: string;
}

export interface IChainManifestsCache {
  /** Сохранить/обновить снимок активных ключей аккаунта. */
  put(account: string, activeKeys: string[]): Promise<void>;
  /** Прочитать снимок (null — кэша для аккаунта нет/истёк). */
  get(account: string): Promise<AccountManifest | null>;
}

export const CHAIN_MANIFESTS_CACHE = Symbol('ChainManifestsCache');
