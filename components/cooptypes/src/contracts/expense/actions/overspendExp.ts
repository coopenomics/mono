import * as Permissions from '../../../common/permissions'
import type * as Expense from '../../../interfaces/expense'
import { Actors } from '../../../common'

/**
 * overspendexp — доплата при перерасходе ADVANCE.
 * Контракт зовёт Ledger2::apply(OVERSPEND) + сразу Ledger2::apply(ADVANCE_REPORT) одной транзакцией.
 * См. expense.hpp::overspendexp.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'overspendexp'

/** @interface */
export type IOverspendExp = Expense.IOverspendexp
