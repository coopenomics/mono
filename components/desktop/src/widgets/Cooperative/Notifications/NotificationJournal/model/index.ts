import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { api } from '../api';
import type { INotification, INotificationsFilter } from './types';

export * from './types';

const namespace = 'notification-journal';
const PAGE_LIMIT = 25;

export const useNotificationJournalStore = defineStore(namespace, () => {
  const items = ref<INotification[]>([]);
  const totalCount = ref(0);
  const totalPages = ref(1);
  const currentPage = ref(1);
  const loading = ref(false);
  // Активные фильтры без coopname — он подставляется при запросе.
  const filter = ref<Omit<INotificationsFilter, 'coopname'>>({});

  const hasMore = computed(() => currentPage.value < totalPages.value);

  function coopname(): string {
    return useSystemStore().info.coopname;
  }

  async function load(page = 1): Promise<void> {
    loading.value = true;
    try {
      const result = await api.loadNotifications({
        filter: { coopname: coopname(), ...filter.value },
        pagination: { page, limit: PAGE_LIMIT, sortOrder: 'DESC' },
      });
      items.value = page === 1 ? result.items : [...items.value, ...result.items];
      totalCount.value = result.totalCount;
      totalPages.value = result.totalPages;
      currentPage.value = result.currentPage;
    } finally {
      loading.value = false;
    }
  }

  async function applyFilter(next: Omit<INotificationsFilter, 'coopname'>): Promise<void> {
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
    resend,
  };
});
