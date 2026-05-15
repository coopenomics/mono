import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Backend закрывает один Order по таймауту цикла отсечки (Story 4.3, p.mkt.supply).
 * Per-Order: o.mkt.unblk на total_cost + статус active → cancelled.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'expireorder'

/**
 * @interface
 */
export type IExpireOrder = Marketplace.IExpireOrder
