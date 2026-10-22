import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api';
import type { IShareTransferState, IShareTransfersPagination } from './types';

/**
 * Страница трансляции паевого взноса и кнопка в шапке читают одно состояние:
 * остаток пайщика в Благоросте и историю трансляций. Кнопка после трансляции
 * кладёт сюда ответ сервера, страница перечитывает историю.
 */
export const useShareTransferStore = defineStore('capitalShareTransferStore', () => {
  const state = ref<IShareTransferState | null>(null);
  const transfers = ref<IShareTransfersPagination | null>(null);

  async function loadState(username: string): Promise<void> {
    state.value = await api.loadState({ username });
  }

  /** Без пайщика — история всего кооператива (председателю). */
  async function loadTransfers(username?: string): Promise<void> {
    transfers.value = await api.loadTransfers({
      filter: username ? { username } : undefined,
      options: { page: 1, limit: 100, sortOrder: 'DESC' },
    });
  }

  function setState(next: IShareTransferState): void {
    state.value = next;
  }

  return { state, transfers, loadState, loadTransfers, setState };
});
