import * as Permissions from '../../../common/permissions'
import type * as Expense from '../../../interfaces/expense'
import { Actors } from '../../../common'

/**
 * declexp — отклонение СЗ-предложения. CREATED/REPORT_SUBMITTED → DECLINED.
 * Capitalization Благороста НЕ запускается. См. expense.hpp::declexp.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'declexp'

/** @interface */
export type IDeclineExp = Expense.IDeclexp
