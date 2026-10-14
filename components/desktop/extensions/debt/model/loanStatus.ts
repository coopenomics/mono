import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { t } from '../i18n';

/** Состояние займа → подпись и цвет бейджа. */
const VARIANTS: Record<string, BaseBadgeVariant> = {
  CREATED: 'info',
  AUTHORIZED: 'info',
  SIGNED: 'info',
  PAYING: 'info',
  PAYDECLINED: 'warn',
  ISSUED: 'pos',
  OVERDUE: 'neg',
  CLOSED: 'neutral',
  DECLINED: 'neutral',
  UNDEFINED: 'neutral',
};

/** Закрытый заём: остаток нулевой — погашен деньгами, иначе закрыт обращением обеспечения. */
function closedKey(remaining?: string | null): 'REPAID' | 'WRITTEN_OFF' {
  return (parseFloat(remaining ?? '0') || 0) > 0 ? 'WRITTEN_OFF' : 'REPAID';
}

export function loanStatusLabel(status: string, loan?: { remaining?: string | null }): string {
  if (status === 'CLOSED' && loan) return t(`debt.status.${closedKey(loan.remaining)}` as never);
  return t(`debt.status.${status in VARIANTS ? status : 'UNDEFINED'}` as never);
}

/** Остаток к возврату: у закрытого и отклонённого займа обязательств нет — ноль в валюте займа. */
export function remainingAmount(loan: { status: string; remaining?: string | null; amount?: string | null }): string {
  if (isOutstanding(loan.status)) return String(loan.remaining ?? '');
  const symbol = String(loan.amount ?? '').split(' ')[1] ?? '';
  return symbol ? `0 ${symbol}` : '0';
}

export function loanStatusVariant(status: string): BaseBadgeVariant {
  return VARIANTS[status] ?? 'neutral';
}

/** До выплаты заём отменяется: обеспечение возвращается в программу. */
export function isCancellable(status: string): boolean {
  return status === 'CREATED' || status === 'AUTHORIZED' || status === 'SIGNED' || status === 'PAYDECLINED';
}

/** Заём выдан и не закрыт — у него есть остаток и срок. */
export function isOutstanding(status: string): boolean {
  return status === 'ISSUED' || status === 'OVERDUE';
}
