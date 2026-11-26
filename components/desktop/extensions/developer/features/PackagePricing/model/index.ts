// 487-31: состояние страницы «Тарифы» стола разработчика.
import { ref } from 'vue';
import { api, type IPackagePricing, type ISetPackagePricingInput } from '../api';

export type { IPackagePricing, ISetPackagePricingInput };

export function usePackagePricing() {
  const items = ref<IPackagePricing[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const isSubmitting = ref(false);
  const actionError = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      items.value = await api.listPricing();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  /** Назначить цену; строка пакета обновляется ответом каталога. */
  async function setPrice(data: ISetPackagePricingInput): Promise<boolean> {
    isSubmitting.value = true;
    actionError.value = null;
    try {
      const saved = await api.setPricing(data);
      items.value = items.value.map((p) => (p.packageId === saved.packageId ? saved : p));
      return true;
    } catch (e) {
      actionError.value = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  return { items, loading, error, isSubmitting, actionError, load, setPrice };
}
