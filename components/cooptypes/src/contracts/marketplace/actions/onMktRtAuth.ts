import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Обратный вызов от soviet::exec после утверждения Протокола 1117 по гарантийному возврату: одной транзакцией o.mkt.return (Дт 10 / Кт 80) и возврат членского взноса участка; заявка стирается. require_auth(_soviet).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'onmktrtauth'

/**
 * @interface
 */
export type IOnMktRtAuth = Marketplace.IOnMktRtAuth
