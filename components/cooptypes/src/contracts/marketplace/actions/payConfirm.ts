import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Callback от gateway::outcomplete — подтверждение фактического банковского
 * перевода поставщику (E11 техдолг 598-16, Locked Decision L12). Inline-action,
 * отправляется контрактом gateway; backend сам этот action не дёргает.
 * Авторизация — `_gateway`. Здесь применяется o.mkt.payout (Дт 76 / Кт 51) на
 * принятую стоимость `accepted_cost` за вычетом удержанного долга и
 * `order.payout_status` переходит PENDING → COMPLETED; заказ в статусе
 * `refused` после проводки стирается.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'payconfirm'

/**
 * @interface
 */
export type IPayConfirm = Marketplace.IPayConfirm
