import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Совет исполняет одну позицию проекта списания (Story 8.3, p.mkt.wroff).
 * Per-item композитная пара o.mkt.wroff + o.mkt.wroff2 (атомарно). Backend
 * проходит циклом по неисполненным items. Когда все items.executed = true —
 * статус автоматически PROPOSED → EXECUTED. Подписант авторизован для
 * items[item_index].braname через Branch::is_user_authorized.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'execwroff'

/**
 * @interface
 */
export type IExecWroff = Marketplace.IExecWroff
