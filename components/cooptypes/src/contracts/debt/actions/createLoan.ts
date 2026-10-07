import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Заявление на беспроцентный заём под обеспечение паевым взносом: заявление и договор с подписью пайщика.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'createloan'

/**
 * @interface
 */
export type ICreateLoan = Debt.ICreateloan
