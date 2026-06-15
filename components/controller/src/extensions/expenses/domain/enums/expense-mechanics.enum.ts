import { registerEnumType } from '@nestjs/graphql';

/**
 * Способ оплаты item-а в СЗ-расходе.
 *  - ADVANCE — пайщик-получатель платит и приносит чек.
 *  - DIRECT  — кассир/председатель платит организации напрямую.
 *
 * Зеркалит `ExpenseDomain::Mechanics` из `expense.hpp`.
 */
export enum ExpenseMechanics {
  ADVANCE = 'ADVANCE',
  DIRECT = 'DIRECT',
}

registerEnumType(ExpenseMechanics, {
  name: 'ExpenseMechanics',
  description: 'Способ оплаты строки расхода.',
});
