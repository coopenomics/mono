import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Поставщик отказывается от одного Order'а до акцепта (Story 4.5, p.mkt.supply).
 * Per-Order: o.mkt.unblk на total_cost; запись заказа стирается из RAM
 * (терминал жизненного цикла), история — в журнале действий.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'declineorder'

/**
 * @interface
 */
export type IDeclineOrder = Marketplace.IDeclineOrder
