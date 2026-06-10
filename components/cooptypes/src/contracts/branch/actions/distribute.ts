import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Раскладка членского взноса по кошелькам КУ при финализации заказа: персональная часть
 * по весам (o.brn.person) + остальное в общий кошелёк КУ (o.brn.common). Вызывается inline
 * контрактом-источником (marketplace::signiss2).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'distribute'

/**
 * @interface
 */
export type IDistribute = Branch.IDistribute
