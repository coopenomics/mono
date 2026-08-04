import { rawTransactionSelector } from '../common/transactionSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

// Результат отчёта по строке-авансу: исход (закрыто / ожидается возврат / доплата),
// сумма разницы к расчёту и хэш заведённой платёжки расчёта; transaction заполнен
// только при CLOSED (on-chain reportexp).
export const rawExpenseReportResultSelector = {
  outcome: true,
  settlement_amount: true,
  settlement_payment_hash: true,
  transaction: rawTransactionSelector,
}

export const expenseReportResultSelector = Selector('ExpenseReportResult')(rawExpenseReportResultSelector)

export type ExpenseReportResultModel = InputType<
  GraphQLTypes['ExpenseReportResult'],
  typeof rawExpenseReportResultSelector
>
