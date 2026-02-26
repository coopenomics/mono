import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя действия
 * Требуется авторизация {@link Actors._username | аккаунта пользователя}.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

/**
 * Имя действия
 */
export const actionName = 'offer'

/**
 * @interface
 */
export type ICreateOffer = Marketplace.IWoffer
