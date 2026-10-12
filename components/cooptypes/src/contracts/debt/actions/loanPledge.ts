import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Пайщик приложил договор залога имущественного права (той же транзакцией, что заявление).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'loanpledge'

/**
 * @interface
 */
export type ILoanPledge = Debt.ILoanpledge
