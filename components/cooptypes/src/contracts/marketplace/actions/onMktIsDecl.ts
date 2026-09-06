import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Обратный вызов от soviet при отказе или просрочке повестки по выдаче: issuepend → readyrecv, документы выдачи снимаются. require_auth(_soviet).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'onmktisdecl'

/**
 * @interface
 */
export type IOnMktIsDecl = Marketplace.IOnMktIsDecl
