import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Председатель / trustee КУ выдачи открывает выдачу первой подписью АПП-выдачи
 * (Story 6.1, p.mkt.supply). Без ledger2-операций. Статус accepted_to_coop →
 * ready_to_receive. current_warehouse_braname = delivery_braname (фиксация
 * факта логистической передачи имущества на склад выдачи).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'signiss1'

/**
 * @interface
 */
export type ISignIss1 = Marketplace.ISignIss1
