import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Кассир выплатил заём (обратный вызов шлюза).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'loanpaid'

/**
 * @interface
 */
export type ILoanPaid = Debt.ILoanpaid
