import * as Permissions from '../../../common/permissions'
import type * as Expense from '../../../interfaces/expense'
import { Actors } from '../../../common'

/**
 * authexp — авторизация СЗ советом (signact2 decision_doc, type=2011).
 * CREATED → AUTHORIZED. См. expense.hpp::authexp.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'authexp'

/** @interface */
export type IAuthExp = Expense.IAuthexp
