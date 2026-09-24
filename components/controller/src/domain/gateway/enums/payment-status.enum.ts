import { PaymentStatus } from '@coopenomics/innercoop';
import { t } from '~/i18n';

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
  [PaymentStatus.AWAITING_AUTHORIZATION]: t('gateway.paymentStatus.status.pendingCouncil'),
  [PaymentStatus.PENDING]: t('gateway.paymentStatus.status.pendingPayment'),
  [PaymentStatus.PROCESSING]: t('gateway.paymentStatus.status.processing'),
  [PaymentStatus.PAID]: t('gateway.paymentStatus.status.paid'),
  [PaymentStatus.COMPLETED]: t('gateway.paymentStatus.status.processed'),
  [PaymentStatus.FAILED]: t('gateway.paymentStatus.status.failed'),
  [PaymentStatus.EXPIRED]: t('gateway.paymentStatus.status.expired'),
  [PaymentStatus.CANCELLED]: t('gateway.paymentStatus.status.cancelled'),
  [PaymentStatus.REFUNDED]: t('gateway.paymentStatus.status.rejected'),
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
