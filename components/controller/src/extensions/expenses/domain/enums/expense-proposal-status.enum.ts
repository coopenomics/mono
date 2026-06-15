import { registerEnumType } from '@nestjs/graphql';

/**
 * Доменный статус СЗ-расхода. Зеркалит `ExpenseDomain::ProposalStatus`
 * из `components/contracts/cpp/expense/expense.hpp`.
 */
export enum ExpenseProposalStatus {
  CREATED = 'CREATED',
  AUTHORIZED = 'AUTHORIZED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  REPORT_SUBMITTED = 'REPORT_SUBMITTED',
  CLOSED = 'CLOSED',
  DECLINED = 'DECLINED',
  UNDEFINED = 'UNDEFINED',
}

registerEnumType(ExpenseProposalStatus, {
  name: 'ExpenseProposalStatus',
  description: 'Статус сметы расхода.',
});
