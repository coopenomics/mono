import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Председатель отказывает в гарантийном возврате на очном осмотре (Story 7.3, p.mkt.return).
 * Финальное решение, без ledger2-операций. Статус approved_for_visit → rejected_at_ku.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'rejretrn'

/**
 * @interface
 */
export type IRejRetrn = Marketplace.IRejRetrn
