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

/**
 * Закрытый заём: обеспечение обращается только из просрочки, поэтому заём,
 * закрытый из состояния «выдан» или с нулевым остатком, погашен деньгами.
 */
function closedKey(loan: { remaining?: string | null; chain_status?: string | null }): 'REPAID' | 'WRITTEN_OFF' {
  if ((parseFloat(loan.remaining ?? '0') || 0) === 0) return 'REPAID';
  return loan.chain_status === 'issued' ? 'REPAID' : 'WRITTEN_OFF';
}

export function loanStatusLabel(status: string, loan?: { remaining?: string | null; chain_status?: string | null }): string {
  if (status === 'CLOSED' && loan) return t(`debt.status.${closedKey(loan)}` as never);
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
