import { onBeforeUnmount, ref } from 'vue';
import { api } from '../api';
import type { IGlobalSearchGroup } from './types';

/** Короче двух символов сервер не ищет — и мы не спрашиваем. */
const MIN_QUERY_LENGTH = 2;
/** Сколько находок показывать в каждой группе. */
const HITS_PER_GROUP = 5;
const DEBOUNCE_MS = 250;

/**
 * Единый поиск окна столов и страниц: пайщики, документы и записи приложений.
 * Запрос уходит после паузы в наборе; ответ на устаревший запрос отбрасывается,
 * чтобы медленный ответ на «Ив» не затёр быстрый ответ на «Иванов».
 */
export function useGlobalSearch() {
  const groups = ref<IGlobalSearchGroup[]>([]);
  const loading = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;

  function reset(): void {
    clearTimeout(timer);
    requestId++;
    groups.value = [];
    loading.value = false;
  }

  function setQuery(query: string): void {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      reset();
      return;
    }
    clearTimeout(timer);
    loading.value = true;
    const id = ++requestId;
    // timing: debounce — поиск после паузы в наборе, а не на каждую букву
    timer = setTimeout(async () => {
      try {
        const result = await api.globalSearch({ query: q, limit: HITS_PER_GROUP });
        if (id === requestId) groups.value = result;
      } catch {
        // Окно продолжает искать по столам и страницам; отказ сервера не
        // заслуживает всплывающей ошибки поверх набора.
        if (id === requestId) groups.value = [];
      } finally {
        if (id === requestId) loading.value = false;
      }
    }, DEBOUNCE_MS);
  }

  onBeforeUnmount(() => clearTimeout(timer));

  return { groups, loading, setQuery, reset };
}
