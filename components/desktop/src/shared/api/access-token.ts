import { getAccessToken } from '@coopenomics/auth';
import { useGlobalStore } from '../store';

/**
 * Текущий access-токен пайщика для REST-вызовов контроллера (не GraphQL).
 *
 * Входов два: CoopID (токен держит контур `@coopenomics/auth`, SDK берёт его
 * через provider) и легаси-вход по ключу (токен в хранилище `useGlobalStore`).
 * Код, который читал только хранилище ключевого входа, при входе через CoopID
 * получал `undefined` и молча работал гостем: так стол не запрашивал список
 * фронтов приложений каталога, и стол пакета не появлялся в меню (26.10.2026).
 *
 * Порядок как у SDK: сначала CoopID, при его отсутствии — легаси-токен; без
 * входа — null (на сервере CoopID не настроен, поэтому там всегда легаси-путь).
 */
export async function resolveAccessToken(): Promise<string | null> {
  if (typeof window !== 'undefined') {
    try {
      return await getAccessToken();
    } catch {
      // Сессии CoopID нет — остаётся легаси-токен.
    }
  }
  return useGlobalStore().tokens?.access?.token ?? null;
}
