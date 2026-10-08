import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { t } from '../i18n';

/** Состояние займа → подпись и цвет бейджа. */
const VARIANTS: Record<string, BaseBadgeVariant> = {
  CREATED: 'info',
  AUTHORIZED: 'info',
  SIGNED: 'warn',
  PAYING: 'info',
  ISSUED: 'pos',
  OVERDUE: 'neg',
  CLOSED: 'neutral',
  DECLINED: 'neutral',
  UNDEFINED: 'neutral',
};

export function loanStatusLabel(status: string): string {
  return t(`debt.status.${status in VARIANTS ? status : 'UNDEFINED'}`);
}

export function loanStatusVariant(status: string): BaseBadgeVariant {
  return VARIANTS[status] ?? 'neutral';
}

/** До выплаты заём отменяется: обеспечение возвращается в программу. */
export function isCancellable(status: string): boolean {
  return status === 'CREATED' || status === 'AUTHORIZED' || status === 'SIGNED';
}

/** Заём выдан и не закрыт — у него есть остаток и срок. */
export function isOutstanding(status: string): boolean {
  return status === 'ISSUED' || status === 'OVERDUE';
}
