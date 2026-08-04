import { ExpenseContract } from 'cooptypes'
import type { TransactResult } from '@wharfkit/session'

/**
 * Блокчейн-порт контракта `expense`. Hexagonal: domain видит интерфейс,
 * implementation в `infrastructure/blockchain/adapters`.
 *
 * 6 actions, доступных backend'у. Авторизация (`authexp`) и отклонение
 * (`declexp`) СЗ исполняются контрактом soviet как callbacks решения совета —
 * backend их не вызывает.
 *
 *   - `createexp`    — создание + подача СЗ (signact1 statement_doc, type=2010);
 *                      ставит вопрос в повестку совета
 *   - `payexp`       — оплата item (ADVANCE/DIRECT)
 *   - `reportexp`    — закрытие item чеком (ADVANCE)
 *   - `returnexp`    — возврат неиспользованного аванса
 *   - `overspendexp` — доплата при перерасходе (ADVANCE)
 *   - `closeexp`     — финализация СЗ-отчёта (REPORT_SUBMITTED → CLOSED)
 */
export interface ExpensesBlockchainPort {
  createExp(data: ExpenseContract.Actions.CreateExp.ICreateExp): Promise<TransactResult>
  payExp(data: ExpenseContract.Actions.PayExp.IPayExp): Promise<TransactResult>
  reportExp(data: ExpenseContract.Actions.ReportExp.IReportExp): Promise<TransactResult>
  returnExp(data: ExpenseContract.Actions.ReturnExp.IReturnExp): Promise<TransactResult>
  overspendExp(data: ExpenseContract.Actions.OverspendExp.IOverspendExp): Promise<TransactResult>
  closeExp(data: ExpenseContract.Actions.CloseExp.ICloseExp): Promise<TransactResult>
}

export const EXPENSES_BLOCKCHAIN_PORT = Symbol('ExpensesBlockchainPort')
