import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Акт приёма-передачи имущества: вторая подпись председателя участка — имущество принято (o.mkt.iprop, Дт 10 / Кт 80). Задача 99D-27.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'act2iprop'

/**
 * @interface
 */
export type IAct2IProp = Marketplace.IAct2IProp
