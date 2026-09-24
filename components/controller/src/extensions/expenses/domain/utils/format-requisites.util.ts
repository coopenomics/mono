
import type { InnerPaymentMethod, InnerSbpData, InnerBankTransferData } from '@coopenomics/innercoop';
import { t } from '../../i18n';
/**
 * Полная строка реквизитов платёжного метода — для документов (СЗ в совет,
 * поручение бухгалтеру). Сокращённое представление для UI делает фронт.
 */
export function formatPaymentMethodRequisites(method: InnerPaymentMethod): string {
  if (method.method_type === 'sbp') {
    const data = method.data as InnerSbpData;
    return t('expenses.requisites.sbpLine', { phone: data.phone });
  }

  const data = method.data as InnerBankTransferData;
  const parts = [t('expenses.requisites.bankTransferLine', { account: data.account_number })];
  if (data.bank_name) parts.push(data.bank_name);
  if (data.details?.bik) parts.push(t('expenses.requisites.bikLine', { bik: data.details.bik }));
  if (data.details?.corr) parts.push(t('expenses.requisites.corrAccountLine', { corr: data.details.corr }));
  if (data.card_number) parts.push(t('expenses.requisites.cardLine', { card: data.card_number }));
  return parts.join(', ');
}
