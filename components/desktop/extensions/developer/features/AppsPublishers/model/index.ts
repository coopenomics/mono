// 487-27: состояние страницы «Издатели» стола разработчика.
import { ref } from 'vue';
import { api, type IAppsPublisher, type IAssignmentInput } from '../api';

export type { IAppsPublisher, IAssignmentInput };

export function useAppsPublishers() {
  const items = ref<IAppsPublisher[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const isSubmitting = ref(false);
  const actionError = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      items.value = await api.listPublishers();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function run(op: () => Promise<unknown>): Promise<boolean> {
    isSubmitting.value = true;
    actionError.value = null;
    try {
      await op();
      await load();
      return true;
    } catch (e) {
      actionError.value = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  const add = (data: IAssignmentInput) => run(() => api.addPublisher(data));
  const remove = (data: IAssignmentInput) => run(() => api.removePublisher(data));

  return { items, loading, error, isSubmitting, actionError, load, add, remove };
}
