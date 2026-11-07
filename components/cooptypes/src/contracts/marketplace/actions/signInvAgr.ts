import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Договор участия в хозяйственной деятельности по ЦПП «Стол заказов» (registry 1118): один на пайщика в кооперативе. Задача 99D-27.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'signinvagr'

/**
 * @interface
 */
export type ISignInvAgr = Marketplace.ISignInvAgr
