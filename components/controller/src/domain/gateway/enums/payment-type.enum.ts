import { PaymentType, PaymentDirection } from '@coopenomics/innercoop';

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
  [PaymentType.REGISTRATION]: 'Вступительный и мин. паевой взносы',
  [PaymentType.DEPOSIT]: 'Паевой взнос',
  [PaymentType.WITHDRAWAL]: 'Возврат паевого взноса',
  [PaymentType.PAYMENT]: 'Оплата',
  [PaymentType.REGISTRATION_REFUND]: 'Возврат вступит. и мин.паевого взноса',
  [PaymentType.MEMBERSHIP_EXIT]: 'Возврат паевого взноса при выходе из кооператива',
  [PaymentType.EXPENSE]: 'Оплата расхода по служебной записке',
  [PaymentType.EXPENSE_RETURN]: 'Возврат неиспользованного аванса под отчёт',
  [PaymentType.EXPENSE_OVERSPEND]: 'Доплата по перерасходу аванса',
  [PaymentType.AID]: 'Материальная помощь',
};

/**
 * Налоговая оговорка для назначения платежа. Взносы пайщика (вступительный,
 * минимальный паевой, паевой) и их возврат НДС не облагаются. Оговорка обязана
 * присутствовать целиком в memo каждого платежа — это единый источник назначения:
 * провайдеры QR (qrpay/sberpoll) её больше НЕ дописывают, чтобы не задвоить.
 */
export const VAT_EXEMPT_NOTE = 'НДС не облагается.';

/**
 * Человекочитаемые названия направлений платежей
 */
export const PAYMENT_DIRECTION_LABELS: Record<PaymentDirection, string> = {
  [PaymentDirection.INCOMING]: 'Входящий',
  [PaymentDirection.OUTGOING]: 'Исходящий',
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
];
