import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Председатель подписал договор (обратный вызов запроса одобрения).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'loansigned'

/**
 * @interface
 */
export type ILoanSigned = Debt.ILoansigned
