import { registerEnumType } from '@nestjs/graphql';

/**
 * Состояние выданного аванса под отчёт на кассе:
 *  - AWAITING_REPORT — аванс выдан, получатель ещё не отчитался;
 *  - SETTLEMENT — отчёт подан с расхождением, ждёт возврата остатка или доплаты;
 *  - REPORTED — отчёт принят, аванс закрыт.
 */
export enum ExpenseAdvanceState {
  AWAITING_REPORT = 'AWAITING_REPORT',
  SETTLEMENT = 'SETTLEMENT',
  REPORTED = 'REPORTED',
}

registerEnumType(ExpenseAdvanceState, {
  name: 'ExpenseAdvanceState',
  description: 'Состояние выданного аванса под отчёт.',
});
