import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Обратный вызов от soviet при отказе совета по гарантийному возврату: retpend → retdecl, имущество ждёт заказчика на участке. require_auth(_soviet).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'onmktrtdecl'

/**
 * @interface
 */
export type IOnMktRtDecl = Marketplace.IOnMktRtDecl
