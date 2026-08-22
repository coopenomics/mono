import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Председатель / trustee приёмного КУ ставит закрывающую подпись на АПП приёмки
 * по одному Order'у (Story 5.3/5.4, p.mkt.supply). Per-Order: только o.mkt.purch
 * (Дт 10 / Кт 86). Выплата поставщику (o.mkt.payout) отделена в lazy-action
 * `payOut` после подтверждения кассиром фактического банковского перевода
 * (E11 техдолг 598-16, Locked Decision L12). Статус supply_prepared →
 * accepted_to_coop. current_warehouse_braname = accept_braname.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'signchair'

/**
 * @interface
 */
export type ISignChair = Marketplace.ISignChair
