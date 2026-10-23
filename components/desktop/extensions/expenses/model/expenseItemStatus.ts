import { Zeus } from '@coopenomics/sdk';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { t } from '../i18n';

export const expenseItemStatusLabel: Record<Zeus.ExpenseItemStatus, string> = {
  [Zeus.ExpenseItemStatus.UNDEFINED]: t('expenses.expenseItem.status.undefined'),
  [Zeus.ExpenseItemStatus.APPROVED]: t('expenses.expenseItem.status.approved'),
  [Zeus.ExpenseItemStatus.PAID]: t('expenses.expenseItem.status.paid'),
  [Zeus.ExpenseItemStatus.REPORTED]: t('expenses.expenseItem.status.reportSubmitted'),
  [Zeus.ExpenseItemStatus.RETURNED]: t('expenses.expenseItem.status.refund'),
  [Zeus.ExpenseItemStatus.OVERSPENT]: t('expenses.expenseItem.status.overspend'),
};

export const expenseItemStatusVariant: Record<Zeus.ExpenseItemStatus, BaseBadgeVariant> = {
  [Zeus.ExpenseItemStatus.UNDEFINED]: 'neutral',
  [Zeus.ExpenseItemStatus.APPROVED]: 'info',
  [Zeus.ExpenseItemStatus.PAID]: 'warn',
  [Zeus.ExpenseItemStatus.REPORTED]: 'warn',
  [Zeus.ExpenseItemStatus.RETURNED]: 'pos',
  [Zeus.ExpenseItemStatus.OVERSPENT]: 'neg',
};

export function getExpenseItemStatusLabel(status?: Zeus.ExpenseItemStatus | null): string {
  if (!status) return expenseItemStatusLabel[Zeus.ExpenseItemStatus.UNDEFINED];
  return expenseItemStatusLabel[status] || expenseItemStatusLabel[Zeus.ExpenseItemStatus.UNDEFINED];
}

export function getExpenseItemStatusVariant(
  status?: Zeus.ExpenseItemStatus | null,
): BaseBadgeVariant {
  if (!status) return 'neutral';
  return expenseItemStatusVariant[status] || 'neutral';
}

export const expenseMechanicsLabel: Record<Zeus.ExpenseMechanics, string> = {
  [Zeus.ExpenseMechanics.ADVANCE]: t('expenses.expenseItem.status.advance'),
  [Zeus.ExpenseMechanics.DIRECT]: t('expenses.expenseItem.status.directPayment'),
};

export function getExpenseMechanicsLabel(mechanics?: Zeus.ExpenseMechanics | null): string {
  if (!mechanics) return '—';
  return expenseMechanicsLabel[mechanics] || '—';
}
