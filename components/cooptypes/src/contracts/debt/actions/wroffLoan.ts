import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Закрытие займа другого приложения без денег (вызов контракта-источника).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'wroffloan'

/**
 * @interface
 */
export type IWroffLoan = Debt.IWroffloan
