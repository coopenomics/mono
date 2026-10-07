import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Совет разрешил выдачу (обратный вызов совета).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'loanauth'

/**
 * @interface
 */
export type ILoanAuth = Debt.ILoanauth
