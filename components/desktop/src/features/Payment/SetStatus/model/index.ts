import { usePaymentStore } from 'src/entities/Payment/model';
import { api } from '../api';
import { Zeus } from '@coopenomics/sdk';

export const useSetStatus = () => {
  const paymentStore = usePaymentStore();

  // Мутация отвечает, когда смена статуса уже записана, — платёж перечитываем
  // сразу и сливаем в список. Дальнейшие переходы (зачисление в цепи и т. п.)
  // приходят по ленте изменений: список платежей подписан на таблицу payments.
  const setStatus = async (id: string, status: Zeus.PaymentStatus, message?: string) => {
    const result = await api.setPaymentStatus({ id, status, message });
    try {
      await paymentStore.updatePayments({ hash: result.hash });
    } catch (e) {
      console.error('Ошибка при обновлении платежа:', e);
    }
    return result;
  };

  const setPaidStatus = (id: string) => setStatus(id, Zeus.PaymentStatus.PAID);
  const setRefundedStatus = (id: string) => setStatus(id, Zeus.PaymentStatus.REFUNDED);
  const setCompletedStatus = (id: string) => setStatus(id, Zeus.PaymentStatus.COMPLETED);

  // Отклонение платежа без движения средств (например, входящий взнос не поступил
  // или поступил с чужого счёта). Причина сохраняется и показывается пайщику,
  // а статус CANCELLED триггерит уведомление об отклонении.
  const setCancelledStatus = (id: string, message?: string) =>
    setStatus(id, Zeus.PaymentStatus.CANCELLED, message);

  return { setPaidStatus, setRefundedStatus, setCompletedStatus, setCancelledStatus };
};
