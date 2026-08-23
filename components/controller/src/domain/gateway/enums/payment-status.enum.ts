import { PaymentStatus } from '@coopenomics/innercoop';

/**
 * Статусы платежей — перечень живёт в контракте `@coopenomics/innercoop`:
 * расширения заводят платежи и сравнивают состояния, значит список общий.
 * Здесь он доступен под привычным ядру именем, а рядом лежит то, что нужно
 * только ядру: подписи для интерфейса и группировки статусов.
 */
export { PaymentStatus as PaymentStatusEnum };

/**
 * Человекочитаемые названия статусов
 */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PaymentStatus.AWAITING_AUTHORIZATION]: 'Ожидает решения совета',
  [PaymentStatus.PENDING]: 'Ожидает оплаты',
  [PaymentStatus.PROCESSING]: 'Обрабатывается',
  [PaymentStatus.PAID]: 'Оплачен',
  [PaymentStatus.COMPLETED]: 'Обработан',
  [PaymentStatus.FAILED]: 'Не удался',
  [PaymentStatus.EXPIRED]: 'Истек',
  [PaymentStatus.CANCELLED]: 'Отменен',
  [PaymentStatus.REFUNDED]: 'Отклонен',
};

/**
 * Статусы, при которых платеж можно редактировать
 */
export const EDITABLE_PAYMENT_STATUSES = [PaymentStatus.PENDING, PaymentStatus.PROCESSING];

/**
 * Финальные статусы платежей
 */
export const FINAL_PAYMENT_STATUSES = [
  PaymentStatus.COMPLETED,
  PaymentStatus.FAILED,
  PaymentStatus.EXPIRED,
  PaymentStatus.CANCELLED,
  PaymentStatus.REFUNDED,
];
