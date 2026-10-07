import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Платёж не прошёл по реквизитам (обратный вызов шлюза).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'loanpaydecl'

/**
 * @interface
 */
export type ILoanPayDecl = Debt.ILoanpaydecl
