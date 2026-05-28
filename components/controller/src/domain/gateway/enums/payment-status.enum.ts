/**
 * Единый enum для статусов платежей
 * Покрывает все состояния входящих и исходящих платежей
 */
export enum PaymentStatusEnum {
  // Для исходящих платежей: совет ещё не утвердил выплату.
  // Кассиру такие платежи скрываются — он работает только с PENDING.
  AWAITING_AUTHORIZATION = 'awaiting_authorization',

  // Начальные состояния
  PENDING = 'pending',

  // Процесс обработки
  PROCESSING = 'processing',
  PAID = 'paid',

  // Завершенные состояния
  COMPLETED = 'completed',

  // Ошибочные состояния
  FAILED = 'failed',
  EXPIRED = 'expired',

  // Отмененные состояния
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

/**
 * Человекочитаемые названия статусов
 */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatusEnum, string> = {
  [PaymentStatusEnum.AWAITING_AUTHORIZATION]: 'Ожидает решения совета',
  [PaymentStatusEnum.PENDING]: 'Ожидает оплаты',
  [PaymentStatusEnum.PROCESSING]: 'Обрабатывается',
  [PaymentStatusEnum.PAID]: 'Оплачен',
  [PaymentStatusEnum.COMPLETED]: 'Обработан',
  [PaymentStatusEnum.FAILED]: 'Не удался',
  [PaymentStatusEnum.EXPIRED]: 'Истек',
  [PaymentStatusEnum.CANCELLED]: 'Отменен',
  [PaymentStatusEnum.REFUNDED]: 'Отклонен',
};

/**
 * Статусы, при которых платеж можно редактировать
 */
export const EDITABLE_PAYMENT_STATUSES = [PaymentStatusEnum.PENDING, PaymentStatusEnum.PROCESSING];

/**
 * Финальные статусы платежей
 */
export const FINAL_PAYMENT_STATUSES = [
  PaymentStatusEnum.COMPLETED,
  PaymentStatusEnum.FAILED,
  PaymentStatusEnum.EXPIRED,
  PaymentStatusEnum.CANCELLED,
  PaymentStatusEnum.REFUNDED,
];
