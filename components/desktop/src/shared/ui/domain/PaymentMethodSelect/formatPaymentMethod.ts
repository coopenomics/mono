import { t } from 'src/shared/i18n';
/**
 * Сокращённое отображение реквизитов платёжного метода для UI: телефон СБП —
 * со звёздочками, банковский счёт — банк + последние 4 цифры. Полные реквизиты
 * в интерфейсе не показываются — они подставляются сервером в документы.
 */
export interface IPaymentMethodLike {
  method_id: string | number;
  method_type: string;
  data: Record<string, unknown>;
}

export function formatPaymentMethodShort(method: IPaymentMethodLike): string {
  if (method.method_type === 'sbp') {
    const phone = String(method.data?.phone ?? '');
    const masked = phone.length > 4 ? `${phone.slice(0, 2)}***${phone.slice(-2)}` : phone;
    return t('ui.formatPaymentMethod.sbpText', { masked });
  }
  const account = String(method.data?.account_number ?? '');
  const bank = String(method.data?.bank_name ?? '');
  const last4 = account.slice(-4);
  return bank ? `${bank} (***${last4})` : t('ui.formatPaymentMethod.bankAccountText', { last4 });
}
