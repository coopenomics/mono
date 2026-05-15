import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Поставщик первой подписью на АПП приёмки фиксирует партию по одному Order'у
 * (Story 5.3/5.4, p.mkt.supply). Параметр accept_braname — приёмный КУ.
 * Статус accepted → supply_prepared. Без ledger2-операций.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'signsupp'

/**
 * @interface
 */
export type ISignSupp = Marketplace.ISignSupp
