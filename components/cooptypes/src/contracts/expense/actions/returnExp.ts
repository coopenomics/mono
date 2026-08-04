import * as Permissions from '../../../common/permissions'
import type * as Expense from '../../../interfaces/expense'
import { Actors } from '../../../common'

/**
 * returnexp — возврат неиспользованного ADVANCE-остатка.
 * Контракт зовёт Ledger2::apply(ADVANCE_RETURN). См. expense.hpp::returnexp.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'returnexp'

/** @interface */
export type IReturnExp = Expense.IReturnexp
