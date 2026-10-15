import { Zeus } from '@coopenomics/sdk'
import type { BaseBadgeVariant } from 'src/shared/ui/base'
import { t } from 'src/shared/i18n';

/**
 * Статус платежа (кассирский реестр, `Zeus.PaymentStatus`) → canon-вариант
 * бейджа + человекочитаемая подпись. Общее для стола кассира
 * (ListOfPaymentsWidget) и любого другого экрана, показывающего статус
 * конкретного платежа пайщику (например, заявки на матпомощь) — не
 * дублировать карту статусов по каждому экрану.
 */
const STATUS_VARIANTS: Record<string, BaseBadgeVariant> = {
  [Zeus.PaymentStatus.COMPLETED]: 'pos',
  [Zeus.PaymentStatus.PAID]: 'info',
  [Zeus.PaymentStatus.PENDING]: 'warn',
  [Zeus.PaymentStatus.PROCESSING]: 'info',
  [Zeus.PaymentStatus.AWAITING_AUTHORIZATION]: 'warn',
  [Zeus.PaymentStatus.FAILED]: 'neg',
  [Zeus.PaymentStatus.CANCELLED]: 'neg',
  [Zeus.PaymentStatus.EXPIRED]: 'neutral',
  [Zeus.PaymentStatus.REFUNDED]: 'neutral',
}

const STATUS_LABELS: Record<string, string> = {
  [Zeus.PaymentStatus.COMPLETED]: t('payment.paymentStatusDisplay.status.completed'),
  [Zeus.PaymentStatus.PAID]: t('payment.paymentStatusDisplay.status.paid'),
  [Zeus.PaymentStatus.PENDING]: t('payment.paymentStatusDisplay.status.pending'),
  [Zeus.PaymentStatus.PROCESSING]: t('payment.paymentStatusDisplay.status.processing'),
  [Zeus.PaymentStatus.AWAITING_AUTHORIZATION]: t('payment.paymentStatusDisplay.status.awaitingAuthorization'),
  [Zeus.PaymentStatus.FAILED]: t('payment.paymentStatusDisplay.status.failed'),
  [Zeus.PaymentStatus.CANCELLED]: t('payment.paymentStatusDisplay.status.cancelled'),
  [Zeus.PaymentStatus.EXPIRED]: t('payment.paymentStatusDisplay.status.expired'),
  [Zeus.PaymentStatus.REFUNDED]: t('payment.paymentStatusDisplay.status.refunded'),
}

export function paymentStatusVariant(status?: string | null): BaseBadgeVariant {
  if (!status) return 'neutral'
  return STATUS_VARIANTS[status] ?? 'neutral'
}

export function paymentStatusLabel(status?: string | null): string {
  if (!status) return t('payment.paymentStatusDisplay.status.unknown')
  return STATUS_LABELS[status] ?? status
}
