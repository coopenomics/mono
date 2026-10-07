import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Возврат займа с главного кошелька пайщика по заявлению, целиком или частью.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'repayloan'

/**
 * @interface
 */
export type IRepayLoan = Debt.IRepayloan
