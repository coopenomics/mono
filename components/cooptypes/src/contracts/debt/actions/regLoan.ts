import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Регистрация займа, выданного другим приложением (вызов контракта-источника).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'regloan'

/**
 * @interface
 */
export type IRegLoan = Debt.IRegloan
