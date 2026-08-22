import type { StorageAdapter } from '@coopenomics/auth';
import {
  deleteFromIndexedDB,
  getFromIndexedDB,
  setToIndexedDB,
} from 'src/shared/api/indexDB';

/** Тот же IndexedDB-store, что и легаси globalStore; ключи не пересекаются. */
const STORE = 'store';

/**
 * `StorageAdapter` контура CoopID для `@coopenomics/auth`: локальный PIN-кэш ключа
 * (`coopid.wallet.pin-vault`) и копия серверного vault'а (`coopid.wallet.vault`).
 * Бэкенд — тот же IndexedDB (db = coopname, store `store`), что и легаси
 * globalStore; ключи `coopid.wallet.*` с легаси (`encrypted*`) не пересекаются.
 * Скоупится по кооперативу, чтобы кэши разных коопов на устройстве не смешивались.
 *
 * `get` возвращает `null` при отсутствии (idb отдаёт `undefined`) — этого требует
 * контракт адаптера: `loadPinProtected`/`hasPinProtected` различают `null` и значение.
 */
export function createCoopIdStorage(coopname: string): StorageAdapter {
  return {
    async get(key) {
      const raw = await getFromIndexedDB(coopname, STORE, key);
      return raw == null ? null : (raw as string);
    },
    async set(key, value) {
      await setToIndexedDB(coopname, STORE, key, value);
    },
    async remove(key) {
      await deleteFromIndexedDB(coopname, STORE, key);
    },
  };
}
