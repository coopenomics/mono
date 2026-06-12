/**
 * Тип платежа по назначению
 */
export enum PaymentTypeEnum {
  // Входящие платежи (от пользователей к кооперативу)
  REGISTRATION = 'registration', // Регистрационный взнос
  DEPOSIT = 'deposit', // Паевой взнос
  WITHDRAWAL = 'withdrawal', // Возврат паевого взноса
  // Исходящая оплата третьим лицам/поставщикам (например, по акту
  // приёма-передачи) — НЕ возврат паевого взноса: семантика обычной покупки.
  PAYMENT = 'payment',
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
  [PaymentTypeEnum.PAYMENT]: 'Оплата',
};

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
export const OUTGOING_PAYMENT_TYPES = [PaymentTypeEnum.WITHDRAWAL, PaymentTypeEnum.PAYMENT];
