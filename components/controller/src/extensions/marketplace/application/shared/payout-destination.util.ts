
import type { InnerPaymentMethod, InnerSbpData, InnerBankTransferData } from '@coopenomics/innercoop';
import { t } from '../../i18n';
/**
 * Короткая человекочитаемая подпись «куда уходит выплата» для истории выплат
 * поставщика: банк + хвост счёта либо СБП + хвост телефона. Полные реквизиты
 * видит только кассир в общем реестре платежей — здесь маскированный ярлык.
 */
export function formatPayoutDestination(method: InnerPaymentMethod): string {
  if (method.method_type === 'sbp') {
    const phone = (method.data as InnerSbpData).phone ?? '';
    const digits = phone.replace(/\D/g, '');
    return digits ? t('marketplace.payoutDestination.sbpMasked', { digitsTail: digits.slice(-4) }) : t('marketplace.payoutDestination.sbpLabel');
  }
  const bank = method.data as InnerBankTransferData;
  const tail = (bank.account_number ?? '').slice(-4);
  const name = bank.bank_name?.trim() || t('marketplace.payoutDestination.bankAccountLabel');
  return tail ? `${name} •${tail}` : name;
}
