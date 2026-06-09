/**
 * Тип платежа по назначению
 */
export enum PaymentTypeEnum {
  // Входящие платежи (от пользователей к кооперативу)
  REGISTRATION = 'registration', // Регистрационный взнос
  DEPOSIT = 'deposit', // Паевой взнос
  WITHDRAWAL = 'withdrawal', // Возврат паевого взноса
  // Исходящий возврат вступительного и мин. паевого взносов при отказе совета
  // в приёме. Отдельный тип, не WITHDRAWAL — чтобы не путать с возвратом паевого.
  REGISTRATION_REFUND = 'registration_refund',
  // Исходящий платёж кооператива на реквизиты оператора платформы по решению
  // совета об инвестировании в ЦПП оператора. Отдельный тип — у него получатель
  // не пайщик, а кооператив-оператор, и проводка Дт 58 / Кт 51.
  COOPERATIVE_INVESTMENT = 'cooperative_investment',
}

/**
 * Направление платежа
 */
export enum PaymentDirectionEnum {
  INCOMING = 'incoming', // Входящий платеж
  OUTGOING = 'outgoing', // Исходящий платеж
}

/**
 * Человекочитаемые названия типов платежей
 */
export const PAYMENT_TYPE_LABELS: Record<PaymentTypeEnum, string> = {
  [PaymentTypeEnum.REGISTRATION]: 'Вступительный и мин. паевой взносы',
  [PaymentTypeEnum.DEPOSIT]: 'Паевой взнос',
  [PaymentTypeEnum.WITHDRAWAL]: 'Возврат паевого взноса',
  [PaymentTypeEnum.REGISTRATION_REFUND]: 'Возврат вступит. и мин.паевого взноса',
  [PaymentTypeEnum.COOPERATIVE_INVESTMENT]: 'Инвестиция в ЦПП оператора',
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
export const PAYMENT_DIRECTION_LABELS: Record<PaymentDirectionEnum, string> = {
  [PaymentDirectionEnum.INCOMING]: 'Входящий',
  [PaymentDirectionEnum.OUTGOING]: 'Исходящий',
};

/**
 * Определяет направление платежа по его типу
 */
export function getPaymentDirection(type: PaymentTypeEnum): PaymentDirectionEnum {
  const incomingTypes = [PaymentTypeEnum.REGISTRATION, PaymentTypeEnum.DEPOSIT];

  return incomingTypes.includes(type) ? PaymentDirectionEnum.INCOMING : PaymentDirectionEnum.OUTGOING;
}

/**
 * Входящие типы платежей
 */
export const INCOMING_PAYMENT_TYPES = [PaymentTypeEnum.REGISTRATION, PaymentTypeEnum.DEPOSIT];

/**
 * Исходящие типы платежей
 */
export const OUTGOING_PAYMENT_TYPES = [
  PaymentTypeEnum.WITHDRAWAL,
  PaymentTypeEnum.REGISTRATION_REFUND,
  PaymentTypeEnum.COOPERATIVE_INVESTMENT,
];
