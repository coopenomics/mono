import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Оператор участка выдал имущество заказчику обратно после отказа совета или по истечении срока ожидания решения; заявка на возврат стирается.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'handback'

/**
 * @interface
 */
export type IHandBack = Marketplace.IHandBack
