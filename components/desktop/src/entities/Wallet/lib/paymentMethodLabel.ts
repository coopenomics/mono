import { t } from 'src/shared/i18n';
import type { IPaymentMethodData, IBankTransferData, ISBPData } from '../model/types';

function isSBPData(data: ISBPData | IBankTransferData): data is ISBPData {
  return (data as ISBPData).phone !== undefined;
}

function isBankTransferData(data: ISBPData | IBankTransferData): data is IBankTransferData {
  return (data as IBankTransferData).account_number !== undefined;
}

/** Короткое имя реквизитов для списка: СБП по телефону со звёздочками, банк по последним цифрам счёта. */
export function paymentMethodLabel(method: IPaymentMethodData): string {
  if (method.method_type === 'sbp' && isSBPData(method.data)) {
    const phone = method.data.phone;
    const formatted = phone.length > 2 ? `${phone.slice(0, 2)}***${phone.slice(-2)}` : phone;
    return t('wallet.withdrawButton.sbpMethodLabel', { phone: formatted });
  }
  if (method.method_type === 'bank_transfer' && isBankTransferData(method.data)) {
    const acc = method.data.account_number;
    return t('wallet.withdrawButton.bankTransferMethodLabel', { bank: method.data.bank_name || '', last4: acc.slice(-4) });
  }
  return method.method_type;
}

/** Полные реквизиты — подсказкой под именем. */
export function paymentMethodDescription(method: IPaymentMethodData): string {
  if (method.method_type === 'sbp' && isSBPData(method.data)) {
    return t('wallet.withdrawButton.sbpFullMethodLabel', { phone: method.data.phone });
  }
  if (method.method_type === 'bank_transfer' && isBankTransferData(method.data)) {
    return t('wallet.withdrawButton.bankAccountMethodLabel', { accountNumber: method.data.account_number, bankName: method.data.bank_name });
  }
  return '';
}
