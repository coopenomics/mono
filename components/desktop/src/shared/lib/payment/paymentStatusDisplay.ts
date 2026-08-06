import { Zeus } from '@coopenomics/sdk'
import type { BaseBadgeVariant } from 'src/shared/ui/base'

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
  [Zeus.PaymentStatus.COMPLETED]: 'Выплачено',
  [Zeus.PaymentStatus.PAID]: 'Переведено, ожидает подтверждения',
  [Zeus.PaymentStatus.PENDING]: 'Ожидает обработки',
  [Zeus.PaymentStatus.PROCESSING]: 'В обработке',
  [Zeus.PaymentStatus.AWAITING_AUTHORIZATION]: 'Ожидает подтверждения',
  [Zeus.PaymentStatus.FAILED]: 'Ошибка платежа',
  [Zeus.PaymentStatus.CANCELLED]: 'Отклонено кассиром',
  [Zeus.PaymentStatus.EXPIRED]: 'Истёк срок',
  [Zeus.PaymentStatus.REFUNDED]: 'Возвращено',
}

export function paymentStatusVariant(status?: string | null): BaseBadgeVariant {
  if (!status) return 'neutral'
  return STATUS_VARIANTS[status] ?? 'neutral'
}

export function paymentStatusLabel(status?: string | null): string {
  if (!status) return 'Обрабатывается'
  return STATUS_LABELS[status] ?? status
}
