import { ExpenseContract } from 'cooptypes'

import type { InnerTransactResult } from '@coopenomics/innercoop';

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
  createExp(data: ExpenseContract.Actions.CreateExp.ICreateExp): Promise<InnerTransactResult>
  payExp(data: ExpenseContract.Actions.PayExp.IPayExp): Promise<InnerTransactResult>
  reportExp(data: ExpenseContract.Actions.ReportExp.IReportExp): Promise<InnerTransactResult>
  returnExp(data: ExpenseContract.Actions.ReturnExp.IReturnExp): Promise<InnerTransactResult>
  overspendExp(data: ExpenseContract.Actions.OverspendExp.IOverspendExp): Promise<InnerTransactResult>
  closeExp(data: ExpenseContract.Actions.CloseExp.ICloseExp): Promise<InnerTransactResult>
}

export const EXPENSES_BLOCKCHAIN_PORT = Symbol('ExpensesBlockchainPort')
