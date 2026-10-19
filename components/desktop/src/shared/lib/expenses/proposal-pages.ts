/**
 * Постраничный список служебных записок, живущий по ленте изменений.
 *
 * Реестр расходов, касса и авансы стола кассира грузят списки одинаково: первая
 * страница при открытии, «Показать ещё» дочитывает следующую, а создание,
 * утверждение, оплата и файлы приходят сигналом ленты — показанные страницы
 * перечитываются одним запросом тихо, без каркаса и всплывающей ошибки.
 */
import { computed, onMounted, ref, type ComputedRef, type Ref } from 'vue';
import { FailAlert } from 'src/shared/api/alerts';
import { useFirstLoad } from 'src/shared/lib/composables';
import { liveWindow, useLiveReload, type ChainTableRef } from 'src/shared/lib/realtime';

/** Таблицы расходов в ленте изменений (объявлены приложением расходов на сервере). */
export const EXPENSE_LIVE_TABLES: ChainTableRef[] = [
  { code: 'expenses', table: 'expense_proposals' },
  { code: 'expenses', table: 'expense_files' },
];

/** Страница списка записок, как её отдаёт сервер. */
export interface IProposalPage<T> {
  items?: T[] | null;
  totalCount?: number | null;
  totalPages?: number | null;
  currentPage?: number | null;
}

/** Запрос страницы: новые записки сверху. */
export interface IProposalPageQuery {
  page: number;
  limit: number;
  sortBy: 'created_at';
  sortOrder: 'DESC';
}

export interface ILiveProposalPages<T> {
  items: Ref<T[]>;
  loading: Ref<boolean>;
  /** Идёт первая загрузка — единственный момент для каркаса. */
  firstLoad: ComputedRef<boolean>;
  totalCount: Ref<number>;
  hasMore: ComputedRef<boolean>;
  loadMore: () => void;
  /** Перечитать с первой страницы — после смены отбора. */
  reload: () => Promise<void>;
}

/**
 * `fetch` возвращает `null`, когда спрашивать ещё не о чем (нет кооператива
 * или пайщика в сессии). `extraTables` — таблицы ленты сверх таблиц расходов,
 * от которых зависит список (авансы на кассе живут и по реестру платежей).
 */
export function useLiveProposalPages<T>(
  fetch: (query: IProposalPageQuery) => Promise<IProposalPage<T> | null>,
  pageLimit: number,
  extraTables: ChainTableRef[] = [],
): ILiveProposalPages<T> {
  const items = ref<T[]>([]) as Ref<T[]>;
  // true до первого ответа: первый кадр показывает каркас, а не «пусто».
  const loading = ref(true);
  const firstLoad = useFirstLoad(loading);
  const currentPage = ref(1);
  const totalPages = ref(1);
  const totalCount = ref(0);
  const hasMore = computed(() => currentPage.value < totalPages.value);

  const query = (page: number, limit: number): IProposalPageQuery => ({ page, limit, sortBy: 'created_at', sortOrder: 'DESC' });

  async function loadPage(page: number): Promise<void> {
    try {
      loading.value = true;
      const result = await fetch(query(page, pageLimit));
      if (!result) return;
      const incoming = result.items ?? [];
      items.value = page === 1 ? incoming : [...items.value, ...incoming];
      currentPage.value = result.currentPage ?? page;
      totalPages.value = result.totalPages ?? 1;
      totalCount.value = result.totalCount ?? items.value.length;
    } catch (e) {
      FailAlert(e);
    } finally {
      loading.value = false;
    }
  }

  function loadMore(): void {
    if (loading.value || !hasMore.value) return;
    void loadPage(currentPage.value + 1);
  }

  onMounted(() => {
    void loadPage(1);
  });

  useLiveReload([...EXPENSE_LIVE_TABLES, ...extraTables], async () => {
    const window = liveWindow(currentPage.value, pageLimit);
    try {
      const result = await fetch(query(window.options.page, window.options.limit));
      if (!result) return;
      items.value = result.items ?? [];
      currentPage.value = window.pages;
      totalCount.value = result.totalCount ?? items.value.length;
      totalPages.value = Math.max(1, Math.ceil(totalCount.value / pageLimit));
    } catch (e) {
      console.warn('[expenses] фоновое перечитывание не удалось', e);
    }
  });

  return { items, loading, firstLoad, totalCount, hasMore, loadMore, reload: () => loadPage(1) };
}
