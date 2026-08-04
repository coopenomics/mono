import * as Permissions from '../../../common/permissions'
import type * as Expense from '../../../interfaces/expense'
import { Actors } from '../../../common'

/**
 * closeexp — финализация СЗ-отчёта советом. REPORT_SUBMITTED → CLOSED.
 * При заполненном callback — inline action (capital::createrid для Благороста).
 * См. expense.hpp::closeexp.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'closeexp'

/** @interface */
export type ICloseExp = Expense.ICloseexp
