import * as Permissions from '../../../common/permissions'
import type * as Expense from '../../../interfaces/expense'
import { Actors } from '../../../common'

/**
 * reportexp — закрытие ADVANCE-item чеком. Контракт зовёт Ledger2::apply(ADVANCE_REPORT).
 * Все items REPORTED → proposal становится REPORT_SUBMITTED. См. expense.hpp::reportexp.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'reportexp'

/** @interface */
export type IReportExp = Expense.IReportexp
