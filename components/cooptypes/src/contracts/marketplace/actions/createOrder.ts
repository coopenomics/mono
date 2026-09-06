import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказчик размещает заказ на товар из каталога (p.mkt.supply шаг 1, паевая модель).
 * o.mkt.lock (паевой резерв, без проводки), o.mkt.conv (конвертация недостающей до
 * членского взноса участка части по заявлению 1110 `convert_statement`, w.wal.share →
 * w.mkt.member) и o.mkt.fee (взнос участка с членского кошелька программы). Остаток
 * членского кошелька зачитывается автоматически — тогда заявление пустое.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'createorder'

/**
 * @interface
 */
export type ICreateOrder = Marketplace.ICreateOrder
