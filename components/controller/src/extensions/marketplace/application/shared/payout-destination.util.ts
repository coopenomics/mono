
import type { InnerPaymentMethod, InnerSbpData, InnerBankTransferData } from '@coopenomics/innercoop';
/**
 * Короткая человекочитаемая подпись «куда уходит выплата» для истории выплат
 * поставщика: банк + хвост счёта либо СБП + хвост телефона. Полные реквизиты
 * видит только кассир в общем реестре платежей — здесь маскированный ярлык.
 */
export function formatPayoutDestination(method: InnerPaymentMethod): string {
  if (method.method_type === 'sbp') {
    const phone = (method.data as InnerSbpData).phone ?? '';
    const digits = phone.replace(/\D/g, '');
    return digits ? `СБП •${digits.slice(-4)}` : 'СБП';
  }
  const bank = method.data as InnerBankTransferData;
  const tail = (bank.account_number ?? '').slice(-4);
  const name = bank.bank_name?.trim() || 'Банковский счёт';
  return tail ? `${name} •${tail}` : name;
}
