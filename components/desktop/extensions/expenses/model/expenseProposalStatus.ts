import { Zeus } from '@coopenomics/sdk';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';

export const expenseProposalStatusLabel: Record<Zeus.ExpenseProposalStatus, string> = {
  [Zeus.ExpenseProposalStatus.UNDEFINED]: 'Не определён',
  [Zeus.ExpenseProposalStatus.CREATED]: 'Подан',
  [Zeus.ExpenseProposalStatus.AUTHORIZED]: 'Утверждён советом',
  [Zeus.ExpenseProposalStatus.PARTIALLY_PAID]: 'Частично оплачен',
  [Zeus.ExpenseProposalStatus.REPORT_SUBMITTED]: 'Отчёт подан',
  [Zeus.ExpenseProposalStatus.CLOSED]: 'Закрыт',
  [Zeus.ExpenseProposalStatus.DECLINED]: 'Отклонён',
};

export const expenseProposalStatusVariant: Record<Zeus.ExpenseProposalStatus, BaseBadgeVariant> = {
  [Zeus.ExpenseProposalStatus.UNDEFINED]: 'neutral',
  [Zeus.ExpenseProposalStatus.CREATED]: 'info',
  [Zeus.ExpenseProposalStatus.AUTHORIZED]: 'info',
  [Zeus.ExpenseProposalStatus.PARTIALLY_PAID]: 'warn',
  [Zeus.ExpenseProposalStatus.REPORT_SUBMITTED]: 'warn',
  [Zeus.ExpenseProposalStatus.CLOSED]: 'pos',
  [Zeus.ExpenseProposalStatus.DECLINED]: 'neg',
};

export function getExpenseProposalStatusLabel(status?: Zeus.ExpenseProposalStatus | null): string {
  if (!status) return expenseProposalStatusLabel[Zeus.ExpenseProposalStatus.UNDEFINED];
  return expenseProposalStatusLabel[status] || expenseProposalStatusLabel[Zeus.ExpenseProposalStatus.UNDEFINED];
}

export function getExpenseProposalStatusVariant(
  status?: Zeus.ExpenseProposalStatus | null,
): BaseBadgeVariant {
  if (!status) return 'neutral';
  return expenseProposalStatusVariant[status] || 'neutral';
}
