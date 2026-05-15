import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказчик размещает заказ на товар из каталога (Story 4.1, p.mkt.supply шаг 1).
 * Серия: o.wal.conv (conditional) → o.mkt.assign (conditional) → o.mkt.block.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'createorder'

/**
 * @interface
 */
export type ICreateOrder = Marketplace.ICreateOrder
