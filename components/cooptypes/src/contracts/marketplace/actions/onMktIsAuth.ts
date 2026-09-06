import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Обратный вызов от soviet::exec после утверждения Протокола 1114: issuepend → issueauth, протокол сохраняется в заказе. require_auth(_soviet).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'onmktisauth'

/**
 * @interface
 */
export type IOnMktIsAuth = Marketplace.IOnMktIsAuth
