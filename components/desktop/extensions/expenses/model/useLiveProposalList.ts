import type { Ref } from 'vue';
import { useLiveReload, liveWindow, type ChainTableRef } from 'src/shared/lib/realtime';

/** Таблицы расходов в ленте изменений (объявлены расширением на сервере). */
export const EXPENSE_LIVE_TABLES: ChainTableRef[] = [
  { code: 'expenses', table: 'expense_proposals' },
  { code: 'expenses', table: 'expense_files' },
];

interface ProposalPage<T> {
  items?: T[] | null;
  totalCount?: number | null;
}

interface LiveProposalListState<T> {
  items: Ref<T[]>;
  currentPage: Ref<number>;
  totalPages: Ref<number>;
  totalCount: Ref<number>;
  pageLimit: number;
  /** Запрос страницы окна — тот же, что у первой загрузки экрана. */
  fetch: (options: { page: number; limit: number }) => Promise<ProposalPage<T> | null>;
}

/**
 * Живой список служебных записок: создание, утверждение, оплата и файлы
 * приходят по ленте изменений, и показанные страницы перечитываются одним
 * запросом — новые записки встают на место, изменённые обновляются. Тихо:
 * без индикатора и без всплывающей ошибки, следующий сигнал повторит.
 */
export function useLiveProposalList<T>(state: LiveProposalListState<T>): void {
  useLiveReload(EXPENSE_LIVE_TABLES, async () => {
    const window = liveWindow(state.currentPage.value, state.pageLimit);
    try {
      const result = await state.fetch(window.options);
      if (!result) return;
      state.items.value = result.items ?? [];
      state.currentPage.value = window.pages;
      state.totalCount.value = result.totalCount ?? state.items.value.length;
      state.totalPages.value = Math.max(1, Math.ceil(state.totalCount.value / state.pageLimit));
    } catch (e) {
      console.warn('[expenses] фоновое перечитывание не удалось', e);
    }
  });
}
