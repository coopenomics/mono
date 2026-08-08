import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказ имущества из обезличенного остатка склада кооператива (requirement 76).
 * Продавец — сам кооператив (offerer == coopname); Order рождается сразу в
 * acceptcoop и идёт только через выдачу signiss1/signiss2.
 * Фондируется из членских средств пайщика начисто: o.mkt.lockm (тело,
 * w.mkt.member → w.mkt.order) + o.mkt.lockmf (взнос, w.mkt.member → w.mkt.fee).
 * Паевой пополняет членский кошелёк заранее отдельным действием `convert`.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'stockorder'

/**
 * @interface
 */
export type IStockOrder = Marketplace.IStockOrder
