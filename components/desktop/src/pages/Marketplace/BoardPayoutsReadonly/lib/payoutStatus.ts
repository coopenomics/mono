import type { BaseBadgeVariant } from 'src/shared/ui/base';
import type { StatusFilterOption } from 'src/shared/ui/domain';

/**
 * Статус выплаты поставщику (marketplace) → подпись и вариант бейджа.
 * Один словарь на ленту и на разворот выплаты: иначе таблица и карточка
 * начинают называть одно состояние по-разному.
 */
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Ожидает оплаты',
  COMPLETED: 'Оплачено',
  DECLINED: 'Отклонено',
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
  { key: 'pending', label: 'Ожидают оплаты', statuses: ['PENDING'] },
  { key: 'completed', label: 'Оплачены', statuses: ['COMPLETED'] },
  { key: 'declined', label: 'Отклонены', statuses: ['DECLINED'] },
];
