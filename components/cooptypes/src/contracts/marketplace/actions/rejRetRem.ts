import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Председатель удалённо отказывает в гарантийном возврате (Story 7.2, p.mkt.return).
 * Финальное решение, без ledger2-операций. Статус pending_review → rejected_remote.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'rejretrem'

/**
 * @interface
 */
export type IRejRetRem = Marketplace.IRejRetRem
