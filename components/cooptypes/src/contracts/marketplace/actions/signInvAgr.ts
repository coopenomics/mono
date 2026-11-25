import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Договор об участии в хозяйственной деятельности кооперативного участка (registry 1118): заключается на каждый участок отдельно. Задачи 99D-27, 99D-35.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'signinvagr'

/**
 * @interface
 */
export type ISignInvAgr = Marketplace.ISignInvAgr
