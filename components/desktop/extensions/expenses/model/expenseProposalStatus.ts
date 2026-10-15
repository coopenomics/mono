import { Zeus } from '@coopenomics/sdk';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { t } from '../i18n';

export const expenseProposalStatusLabel: Record<Zeus.ExpenseProposalStatus, string> = {
  [Zeus.ExpenseProposalStatus.UNDEFINED]: t('expenses.expenseProposal.status.undefined'),
  [Zeus.ExpenseProposalStatus.CREATED]: t('expenses.expenseProposal.status.submitted'),
  [Zeus.ExpenseProposalStatus.AUTHORIZED]: t('expenses.expenseProposal.status.approvedByCouncil'),
  [Zeus.ExpenseProposalStatus.PARTIALLY_PAID]: t('expenses.expenseProposal.status.partiallyPaid'),
  [Zeus.ExpenseProposalStatus.REPORT_SUBMITTED]: t('expenses.expenseProposal.status.reportSubmitted'),
  [Zeus.ExpenseProposalStatus.CLOSED]: t('expenses.expenseProposal.status.closed'),
  [Zeus.ExpenseProposalStatus.DECLINED]: t('expenses.expenseProposal.status.declined'),
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
