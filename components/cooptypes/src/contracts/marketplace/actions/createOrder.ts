import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказчик размещает заказ на товар из каталога (p.mkt.supply шаг 1, паевая модель).
 * o.mkt.lock (паевой резерв, без проводки) + o.mkt.fee (членский взнос участка). Заявления нет.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'createorder'

/**
 * @interface
 */
export type ICreateOrder = Marketplace.ICreateOrder
