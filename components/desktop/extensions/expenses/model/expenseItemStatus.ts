import { Zeus } from '@coopenomics/sdk';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';

export const expenseItemStatusLabel: Record<Zeus.ExpenseItemStatus, string> = {
  [Zeus.ExpenseItemStatus.UNDEFINED]: 'Не определена',
  [Zeus.ExpenseItemStatus.APPROVED]: 'Одобрена',
  [Zeus.ExpenseItemStatus.PAID]: 'Оплачена',
  [Zeus.ExpenseItemStatus.REPORTED]: 'Отчёт подан',
  [Zeus.ExpenseItemStatus.RETURNED]: 'Возврат',
  [Zeus.ExpenseItemStatus.OVERSPENT]: 'Перерасход',
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
  [Zeus.ExpenseMechanics.ADVANCE]: 'Аванс',
  [Zeus.ExpenseMechanics.DIRECT]: 'Прямая оплата',
};

export function getExpenseMechanicsLabel(mechanics?: Zeus.ExpenseMechanics | null): string {
  if (!mechanics) return '—';
  return expenseMechanicsLabel[mechanics] || '—';
}
