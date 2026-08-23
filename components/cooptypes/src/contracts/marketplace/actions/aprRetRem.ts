import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Председатель удалённо одобряет очный визит (Story 7.2, p.mkt.return).
 * Без ledger2-операций. Подписант авторизован для указанного braname через
 * Branch::is_user_authorized. Статус pending_review → approved_for_visit.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'aprretrem'

/**
 * @interface
 */
export type IAprRetRem = Marketplace.IAprRetRem
