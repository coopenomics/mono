import { computed, ref, type Ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { useFirstLoad } from 'src/shared/lib/composables';
import { useLiveReload, type ChainTableRef } from 'src/shared/lib/realtime';
import { useSystemStore } from 'src/entities/System/model';
import { getLoans, type ILoan } from '../api';

/** Зеркало займов в ленте изменений (объявлено расширением на сервере). */
export const DEBT_LIVE_TABLES: ChainTableRef[] = [{ code: 'debt', table: 'debt_loans' }];

const PAGE_SIZE = 20;

/**
 * Список займов с дочиткой страниц. Решение совета, подпись председателя и
 * выплата приходят по ленте изменений — показанные страницы перечитываются
 * тихо, без индикатора.
 */
export interface LoanListFilter {
  status?: string;
  outstanding?: boolean;
  due_within_days?: number;
}

export function useLiveLoanList(filter: Ref<LoanListFilter>) {
  const system = useSystemStore();
  const items = ref<ILoan[]>([]) as Ref<ILoan[]>;
  const totalPages = ref(0);
  const currentPage = ref(1);
  // true до первого запроса: первый кадр показывает каркас, а не «займов нет».
  const loading = ref(true);
  const firstLoad = useFirstLoad(loading);
  const hasMore = computed(() => currentPage.value < totalPages.value);

  async function fetchPage(page: number, limit: number) {
    return getLoans({
      // Состояние приходит строкой вкладки; сервер сверяет его с перечислением.
      filter: { coopname: system.info.coopname, ...filter.value } as never,
      options: { page, limit, sortBy: '_created_at', sortOrder: 'DESC' },
    });
  }

  async function reload(silent = false): Promise<void> {
    try {
      if (!silent) loading.value = true;
      // Перечитываем всё показанное окно одним запросом.
      const result = await fetchPage(1, PAGE_SIZE * currentPage.value);
      items.value = result.items;
      totalPages.value = Math.ceil((result.totalCount ?? 0) / PAGE_SIZE);
    } catch (e) {
      if (!silent) FailAlert(e);
    } finally {
      loading.value = false;
    }
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value) return;
    try {
      loading.value = true;
      const result = await fetchPage(currentPage.value + 1, PAGE_SIZE);
      items.value = [...items.value, ...result.items];
      currentPage.value += 1;
    } catch (e) {
      FailAlert(e);
    } finally {
      loading.value = false;
    }
  }

  function reset(): Promise<void> {
    currentPage.value = 1;
    return reload();
  }

  useLiveReload(DEBT_LIVE_TABLES, () => reload(true));

  return { items, loading, firstLoad, hasMore, reload, reset, loadMore };
}
