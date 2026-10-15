import { PaymentType, PaymentDirection, VAT_EXEMPT_NOTE } from '@coopenomics/innercoop';
import { t } from '~/i18n';

/**
 * Типы и направления платежей — перечни живут в контракте
 * `@coopenomics/innercoop`: расширение заводит платёж своего типа, а кассирский
 * стол ядра обязан такой тип понимать. Здесь они доступны под привычными ядру
 * именами, а рядом — то, что нужно только ядру: подписи, оговорка НДС и
 * группировки по направлению.
 */
export { PaymentType as PaymentTypeEnum, PaymentDirection as PaymentDirectionEnum };

/**
 * Человекочитаемые названия типов платежей
 */
export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  [PaymentType.REGISTRATION]: t('gateway.paymentType.type.entryAndMinShare'),
  [PaymentType.DEPOSIT]: t('gateway.paymentType.type.shareContribution'),
  [PaymentType.WITHDRAWAL]: t('gateway.paymentType.type.shareContributionRefund'),
  [PaymentType.PAYMENT]: t('gateway.paymentType.type.payment'),
  [PaymentType.REGISTRATION_REFUND]: t('gateway.paymentType.type.entryAndMinShareRefund'),
  [PaymentType.MEMBERSHIP_EXIT]: t('gateway.paymentType.type.shareRefundOnExit'),
  [PaymentType.EXPENSE]: t('gateway.paymentType.type.expenseReportPayment'),
  [PaymentType.EXPENSE_RETURN]: t('gateway.paymentType.type.advanceUnusedRefund'),
  [PaymentType.EXPENSE_OVERSPEND]: t('gateway.paymentType.type.advanceOverspendSurcharge'),
  [PaymentType.AID]: t('gateway.paymentType.type.financialAid'),
  [PaymentType.TAX]: t('gateway.paymentType.type.ndflTransfer'),
};

// Оговорка живёт в контракте `@coopenomics/innercoop`: назначение платежа
// формируют и ядро, и расширения, а расширению путь `~/` недоступен.
export { VAT_EXEMPT_NOTE };

/**
 * Человекочитаемые названия направлений платежей
 */
export const PAYMENT_DIRECTION_LABELS: Record<PaymentDirection, string> = {
  [PaymentDirection.INCOMING]: t('gateway.paymentType.direction.incoming'),
  [PaymentDirection.OUTGOING]: t('gateway.paymentType.direction.outgoing'),
};

/**
 * Определяет направление платежа по его типу
 */
export function getPaymentDirection(type: PaymentType): PaymentDirection {
  return INCOMING_PAYMENT_TYPES.includes(type) ? PaymentDirection.INCOMING : PaymentDirection.OUTGOING;
}

/**
 * Входящие типы платежей
 */
export const INCOMING_PAYMENT_TYPES = [PaymentType.REGISTRATION, PaymentType.DEPOSIT, PaymentType.EXPENSE_RETURN];

/**
 * Исходящие типы платежей
 */
export const OUTGOING_PAYMENT_TYPES = [
  PaymentType.WITHDRAWAL,
  PaymentType.PAYMENT,
  PaymentType.REGISTRATION_REFUND,
  PaymentType.MEMBERSHIP_EXIT,
  PaymentType.EXPENSE,
  PaymentType.EXPENSE_OVERSPEND,
  PaymentType.AID,
  PaymentType.TAX,
];
