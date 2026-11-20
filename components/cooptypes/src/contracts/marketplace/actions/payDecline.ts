import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Callback от gateway::outdecline — кассир отметил, что банковский перевод
 * пакета выплаты поставщику не состоялся (Locked Decision L12). Inline-action,
 * отправляется контрактом gateway; backend сам этот action не дёргает.
 * Авторизация — `_gateway`. `outcome_hash` — хэш пакета. Ledger2 НЕ
 * применяется; пакет переходит sent → declined, причина сохраняется. Заказы
 * пакета backend возвращает в ожидание выплаты действием `releasepay`.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'paydecline'

/**
 * @interface
 */
export type IPayDecline = Marketplace.IPayDecline
