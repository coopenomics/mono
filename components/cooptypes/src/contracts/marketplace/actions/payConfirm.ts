import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Callback от gateway::outcomplete — подтверждение фактического банковского
 * перевода пакета выплаты поставщику (Locked Decision L12). Inline-action,
 * отправляется контрактом gateway; backend сам этот action не дёргает.
 * Авторизация — `_gateway`. `outcome_hash` — хэш пакета. Пакет переходит
 * sent → paid; проводки o.mkt.payout (Дт 76 / Кт 51) backend ставит по каждому
 * заказу пакета действием `closepayout`.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'payconfirm'

/**
 * @interface
 */
export type IPayConfirm = Marketplace.IPayConfirm
