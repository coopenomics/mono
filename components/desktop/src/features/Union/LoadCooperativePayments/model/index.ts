import { ref } from 'vue';
import { api, type ICooperativePayment } from '../api';

export function useLoadCooperativePayments() {
  const payments = ref<ICooperativePayment[]>([]);
  const loading = ref(false);
  const error = ref<string>('');

  async function loadPayments(coopname: string, limit?: number): Promise<void> {
    loading.value = true;
    error.value = '';
    try {
      payments.value = await api.loadCooperativePayments(coopname, limit);
    } catch (e: unknown) {
      // Историю показываем рядом с остальной карточкой: её недоступность
      // не должна ронять страницу целиком, поэтому ошибка живёт в баннере.
      error.value = e instanceof Error ? e.message : 'История оплат временно недоступна';
    } finally {
      loading.value = false;
    }
  }

  return { payments, loading, error, loadPayments };
}
