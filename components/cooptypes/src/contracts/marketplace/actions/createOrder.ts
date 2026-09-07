import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказчик размещает заказ на товар из каталога (p.mkt.supply шаг 1, паевая модель).
 * Взнос участка — с внутреннего членского кошелька (o.mkt.fee), тело — паевой резерв
 * o.mkt.lock (w.wal.share → w.mkt.order, без проводки). Заявления нет: недостающую часть
 * взноса пайщик перевёл заранее действием convert по заявлению 1110.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'createorder'

/**
 * @interface
 */
export type ICreateOrder = Marketplace.ICreateOrder
