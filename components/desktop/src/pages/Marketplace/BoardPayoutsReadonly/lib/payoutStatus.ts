import type { BaseBadgeVariant } from 'src/shared/ui/base';
import type { StatusFilterOption } from 'src/shared/ui/domain';
import { t } from 'src/shared/i18n';

/**
 * Статус выплаты поставщику (marketplace) → подпись и вариант бейджа.
 * Один словарь на ленту и на разворот выплаты: иначе таблица и карточка
 * начинают называть одно состояние по-разному.
 */
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: t('marketplace.payout.status.pending'),
  COMPLETED: t('marketplace.payout.status.paid'),
  DECLINED: t('marketplace.payout.status.rejected'),
};

const PAYMENT_STATUS_VARIANT: Record<string, BaseBadgeVariant> = {
  PENDING: 'warn',
  COMPLETED: 'pos',
  DECLINED: 'neg',
};

export function statusLabel(status: string): string {
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

export function statusVariant(status: string): BaseBadgeVariant {
  return PAYMENT_STATUS_VARIANT[status] ?? 'neutral';
}

/** Пункты фильтра по состоянию — в порядке жизненного цикла выплаты. */
export const PAYOUT_STATUS_FILTERS: StatusFilterOption[] = [
  { key: 'pending', label: t('marketplace.payout.status.pendingMany'), statuses: ['PENDING'] },
  { key: 'completed', label: t('marketplace.payout.status.paidMany'), statuses: ['COMPLETED'] },
  { key: 'declined', label: t('marketplace.payout.status.rejectedMany'), statuses: ['DECLINED'] },
];
