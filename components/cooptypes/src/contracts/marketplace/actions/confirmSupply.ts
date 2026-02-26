import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя действия
 * Требуется авторизация {@link Actors._chairman | аккаунта председателя}.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

/**
 * Имя действия
 */
export const actionName = 'supplycnfrm'

/**
 * @interface
 */
export type IConfirmSupply = Marketplace.ISupplcnf
