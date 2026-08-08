import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Председатель принимает гарантийный возврат на очном осмотре (Story 7.4, p.mkt.return).
 * Композитная транзакция o.mkt.return + o.mkt.return2 (compensating forward).
 * Статус approved_for_visit → return_accepted.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'accretrn'

/**
 * @interface
 */
export type IAccRetrn = Marketplace.IAccRetrn
