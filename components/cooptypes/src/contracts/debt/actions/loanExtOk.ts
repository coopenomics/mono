import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Председатель подтвердил продление (обратный вызов запроса одобрения).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'loanextok'

/**
 * @interface
 */
export type ILoanExtOk = Debt.ILoanextok
