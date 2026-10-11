import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Дело, найденное по отсканированному коду (598-62). Общий сканер спрашивает
 * сервер, кто пришёл и за чем, и передаёт столу уже найденное дело — не сырую
 * строку кода. Стол открывает нужный диалог по учётной записи либо
 * идентификатору и сам ничего не разбирает.
 */
export type MarketplaceHandoffMatter =
  | { kind: 'issuance'; account: string }
  | { kind: 'reception'; account: string }
  | { kind: 'shipment'; shipment_id: string }
  | { kind: 'return'; account: string; claim_id: string | null }
  | { kind: 'container'; container_code: string };

/**
 * Передача дела между сканером и столом через стор, не через query-параметр:
 * `router.replace` для очистки URL не дожидался, и при пересборке страницы
 * (первый заход на стол в сессии) дело терялось. Стор переживает переход.
 */
export const useMarketplaceHandoffSignal = defineStore('marketplaceHandoffSignal', () => {
  const pending = ref<MarketplaceHandoffMatter | null>(null);

  function post(matter: MarketplaceHandoffMatter): void {
    pending.value = matter;
  }

  /** Забрать дело на обработку и сразу освободить — повторный маунт не переспросит то же самое. */
  function consume(): MarketplaceHandoffMatter | null {
    const matter = pending.value;
    pending.value = null;
    return matter;
  }

  return { pending, post, consume };
});
