import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказчик отменяет заказ до акцепта поставщиком (Story 4.4, p.mkt.supply).
 * Триггерит o.mkt.unblk на full total_cost.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'cancelorder'

/**
 * @interface
 */
export type ICancelOrder = Marketplace.ICancelOrder
