import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Погашение займа другого приложения на сумму (вызов контракта-источника).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'settleloan'

/**
 * @interface
 */
export type ISettleLoan = Debt.ISettleloan
