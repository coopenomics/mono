import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Callback от `soviet::exec` после авторизации Протокола Совета о списании
 * скоропорта (Story 8.4, p.mkt.wroff). Сигнатура совпадает с
 * AUTHORIZE_CALLBACK_SIGNATURE из soviet.hpp. require_auth(_soviet).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'onmktwoauth'

/**
 * @interface
 */
export type IOnMktWoAuth = Marketplace.IOnMktWoAuth
