/**
 * Подписи статусов шасси расходов — общие для всех пулов, живут в
 * `src/shared/lib/expenses`. Здесь — реэкспорт для существующих импортов capital.
 */
export {
  proposalStatusLabel,
  proposalStatusVariant,
  itemStatusLabel,
  itemStatusVariant,
  mechanicsLabel,
  fileKindLabel,
  shortExpenseId,
  type ExpenseBadgeVariant,
  type ExpenseBadgeVariant as ProgramExpenseBadgeVariant,
} from 'src/shared/lib/expenses';
