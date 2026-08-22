import * as Permissions from '../../../common/permissions'
import type * as Expense from '../../../interfaces/expense'
import { Actors } from '../../../common'

/**
 * payexp — оплата item: ADVANCE (выдача аванса) или DIRECT (прямая оплата).
 * Контракт зовёт Ledger2::apply(operation_code, actual_amount).
 * Для DIRECT сразу за payexp идёт фоновый reportexp. См. expense.hpp::payexp.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'payexp'

/** @interface */
export type IPayExp = Expense.IPayexp
