import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказчик размещает заказ на товар из каталога (p.mkt.supply шаг 1, паевая модель).
 * Внутренний членский кошелёк первым — взнос участка (o.mkt.fee) и тело (o.mkt.lockm →
 * членский резерв w.mkt.morder), остаток тела — паевой резерв o.mkt.lock (w.wal.share →
 * w.mkt.order, без проводки). Заявления нет: недостающее переведено заранее действием
 * convert по заявлению 1110.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'createorder'

/**
 * @interface
 */
export type ICreateOrder = Marketplace.ICreateOrder
