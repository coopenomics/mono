import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { api } from '../api';
import { liveWindow } from 'src/shared/lib/realtime';
import type { INotification, INotificationsFilter } from './types';

export * from './types';

const namespace = 'notification-journal';
const PAGE_LIMIT = 25;

type JournalFilter = Omit<INotificationsFilter, 'coopname'>;

/** Запрос журнала: coopname подставляется, порядок — новые сверху. */
function request(filter: JournalFilter, page: number, limit: number) {
  return api.loadNotifications({
    filter: { coopname: useSystemStore().info.coopname, ...filter },
    pagination: { page, limit, sortOrder: 'DESC' },
  });
}

export const useNotificationJournalStore = defineStore(namespace, () => {
  const items = ref<INotification[]>([]);
  const totalCount = ref(0);
  const totalPages = ref(1);
  const currentPage = ref(1);
  const loading = ref(false);
  // Активные фильтры без coopname — он подставляется при запросе.
  const filter = ref<JournalFilter>({});

  const hasMore = computed(() => currentPage.value < totalPages.value);

  async function load(page = 1): Promise<void> {
    loading.value = true;
    try {
      const result = await request(filter.value, page, PAGE_LIMIT);
      items.value = page === 1 ? result.items : [...items.value, ...result.items];
      totalCount.value = result.totalCount;
      totalPages.value = result.totalPages;
      currentPage.value = result.currentPage;
    } finally {
      loading.value = false;
    }
  }

  /** Перечитать показанные страницы одним запросом (лента изменений), тихо. */
  async function reloadLoaded(): Promise<void> {
    const window = liveWindow(currentPage.value, PAGE_LIMIT);
    try {
      const result = await request(filter.value, 1, window.options.limit);
      items.value = result.items;
      totalCount.value = result.totalCount;
      totalPages.value = Math.max(1, Math.ceil(result.totalCount / PAGE_LIMIT));
      currentPage.value = window.pages;
    } catch (e) {
      console.warn('[notification-journal] фоновое перечитывание не удалось', e);
    }
  }

  async function applyFilter(next: JournalFilter): Promise<void> {
    filter.value = next;
    await load(1);
  }

  async function loadMore(): Promise<void> {
    if (hasMore.value && !loading.value) await load(currentPage.value + 1);
  }

  /** Переотправка ставит новую строку в очередь — перечитываем первую страницу, чтобы она была видна. */
  async function resend(id: string): Promise<void> {
    await api.resendNotification(id);
    await load(1);
  }

  return {
    items,
    totalCount,
    totalPages,
    currentPage,
    loading,
    filter,
    hasMore,
    load,
    applyFilter,
    loadMore,
    reloadLoaded,
    resend,
  };
});
