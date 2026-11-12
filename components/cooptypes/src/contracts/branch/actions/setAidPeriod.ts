import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Длина периода, за который считается предел материальной помощи, секунд; ноль —
 * календарный месяц UTC. Стенд со сжатым временем ставит длину своего месяца.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'setaidperiod'

/**
 * @interface
 */
export type ISetaidperiod = Branch.ISetaidperiod
