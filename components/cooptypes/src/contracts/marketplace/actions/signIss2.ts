import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказчик ставит финальную подпись АПП-выдачи (Story 6.3, p.mkt.supply).
 * Per-Order композитная транзакция с поддержкой actual_quantity ≠ ordered:
 * [unblk при actual<ordered | conv+assign+block при actual>ordered] +
 * consum + consum2. Подписант delivery_signer должен быть авторизован для
 * delivery_braname (Branch::is_user_authorized).
 * Статус ready_to_receive → received.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'signiss2'

/**
 * @interface
 */
export type ISignIss2 = Marketplace.ISignIss2
