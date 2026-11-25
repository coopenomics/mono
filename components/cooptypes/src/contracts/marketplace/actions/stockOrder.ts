import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказ имущества из обезличенного остатка склада кооператива (паевая модель).
 * Продавец — сам кооператив (offerer == coopname); Order рождается сразу в
 * acceptcoop и идёт только через выдачу (readyissue → issuestmt → … → issueact2).
 * Обеспечительная часть паевого взноса (o.mkt.fee) и тело (o.mkt.lockp,
 * w.mkt.share → w.mkt.order) — только со свободного паевого «Стола заказов»
 * (задача 99D-18); недостающее пайщик транслировал заранее действием convert
 * по заявлению 1110. При нехватке — отказ; добора с Цифрового кошелька нет.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'stockorder'

/**
 * @interface
 */
export type IStockOrder = Marketplace.IStockOrder
