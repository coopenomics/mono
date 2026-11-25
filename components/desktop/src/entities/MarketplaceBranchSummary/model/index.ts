import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getBranchSummary, type MarketplaceBranchSummaryView } from '../api';

/**
 * Сводки участков Стола заказов, по одной на участок.
 *
 * Сводку читают двое: страница участка спрашивает «вовлечён ли участок» для
 * полосы с вкладками, вкладка «Стол заказов» показывает содержимое. Хранилище
 * сводит оба чтения в один запрос: параллельные вызовы по одному участку
 * получают одно и то же обещание.
 */
export const useMarketplaceBranchSummaryStore = defineStore('marketplaceBranchSummaryStore', () => {
  const summaries = ref<Record<string, MarketplaceBranchSummaryView>>({});
  const inFlight = new Map<string, Promise<MarketplaceBranchSummaryView>>();

  /** Перечитать сводку участка с сервера. */
  function load(braname: string): Promise<MarketplaceBranchSummaryView> {
    const pending = inFlight.get(braname);
    if (pending) return pending;
    const request = getBranchSummary(braname)
      .then((summary) => {
        summaries.value = { ...summaries.value, [braname]: summary };
        return summary;
      })
      .finally(() => inFlight.delete(braname));
    inFlight.set(braname, request);
    return request;
  }

  return { summaries, load };
});

/** Участок вовлечён в Стол заказов: подключён как пункт выдачи либо имеет взносы инициаторов. */
export function isBranchInvolved(summary: MarketplaceBranchSummaryView | undefined): boolean {
  return Boolean(summary?.issuance_point || summary?.initiators);
}
