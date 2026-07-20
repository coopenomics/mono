import { registerEnumType } from '@nestjs/graphql';

/**
 * Тип получателя платежа в item-е СЗ-расхода.
 *  - SELF   — сам создатель СЗ.
 *  - MEMBER — другой пайщик кооператива.
 *  - ORG    — внешняя организация / поставщик.
 *
 * Зеркалит `ExpenseDomain::RecipientType` из `expense.hpp`.
 */
export enum ExpenseRecipientType {
  SELF = 'SELF',
  MEMBER = 'MEMBER',
  ORG = 'ORG',
}

registerEnumType(ExpenseRecipientType, {
  name: 'ExpenseRecipientType',
  description: 'Тип получателя платежа.',
});
