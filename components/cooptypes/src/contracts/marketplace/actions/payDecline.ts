import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Callback от gateway::outdecline — кассир отметил, что банковский перевод
 * поставщику не состоялся (E11 техдолг 598-16, Locked Decision L12).
 * Inline-action, отправляется контрактом gateway; backend сам этот action не
 * дёргает. Авторизация — `_gateway`. Ledger2 НЕ применяется; `order.payout_status`
 * переходит PENDING → DECLINED, `payout_decline_reason` сохраняется. Backend
 * может повторно вызвать `payOut` после исправления реквизитов.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'paydecline'

/**
 * @interface
 */
export type IPayDecline = Marketplace.IPayDecline
