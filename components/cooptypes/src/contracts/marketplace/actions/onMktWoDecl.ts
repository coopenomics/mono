import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Callback от `soviet::cancelexprd` или decline-эффекта в soviet (Story 8.4).
 * Переводит проект в REJECTED, сохраняет reason. Сигнатура совпадает с
 * DECLINE_CALLBACK_SIGNATURE из soviet.hpp. require_auth(_soviet).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'onmktwodecl'

/**
 * @interface
 */
export type IOnMktWoDecl = Marketplace.IOnMktWoDecl
