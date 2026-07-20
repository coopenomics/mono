import { registerEnumType } from '@nestjs/graphql';

/**
 * Доменный статус item-а в СЗ-расходе. Зеркалит `ExpenseDomain::ItemStatus`
 * из `components/contracts/cpp/expense/expense.hpp`.
 */
export enum ExpenseItemStatus {
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  REPORTED = 'REPORTED',
  RETURNED = 'RETURNED',
  OVERSPENT = 'OVERSPENT',
  UNDEFINED = 'UNDEFINED',
}

registerEnumType(ExpenseItemStatus, {
  name: 'ExpenseItemStatus',
  description: 'Статус строки расхода.',
});
