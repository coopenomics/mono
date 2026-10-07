import * as Permissions from '../../../common/permissions'
import type * as Debt from '../../../interfaces/debt'
import { Actors } from '../../../common'

/**
 * Сверка сроков: просрочка и обращение обеспечения, пачками не более 25 займов.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'sweep'

/**
 * @interface
 */
export type ISweep = Debt.ISweep
