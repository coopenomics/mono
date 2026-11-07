import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Акт приёма-передачи имущества: первая подпись вносящего (registry 1122). Задача 99D-27.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'act1iprop'

/**
 * @interface
 */
export type IAct1IProp = Marketplace.IAct1IProp
