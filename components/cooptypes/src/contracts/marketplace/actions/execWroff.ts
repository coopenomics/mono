import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Backend исполняет одну позицию авторизованного советом проекта списания
 * (Story 8.4, p.mkt.wroff). Per-item композитная пара o.mkt.wroff +
 * o.mkt.wroff2 (атомарно). Backend проходит циклом по неисполненным items;
 * последняя позиция стирает запись проекта из RAM. Авторизация —
 * `coopname`; signer должен быть авторизован для items[item_index].braname
 * через Branch::is_user_authorized.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'execwroff'

/**
 * @interface
 */
export type IExecWroff = Marketplace.IExecWroff
