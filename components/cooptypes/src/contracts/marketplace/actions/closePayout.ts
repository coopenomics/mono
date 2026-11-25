import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказ оплаченного пакета закрывается: o.mkt.payout (Дт 76 / Кт 51) на принятую стоимость за вычетом удержания; заказ pending → completed (после отказа пайщика — стирается). Последний заказ стирает пакет.
 * require_auth(coopname).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'closepayout'

/**
 * @interface
 */
export type IClosepayout = Marketplace.IClosepayout
