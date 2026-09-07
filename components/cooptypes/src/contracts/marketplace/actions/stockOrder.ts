import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказ имущества из обезличенного остатка склада кооператива (паевая модель).
 * Продавец — сам кооператив (offerer == coopname); Order рождается сразу в
 * acceptcoop и идёт только через выдачу (readyissue → issuestmt → … → issueact2).
 * Взнос — с внутреннего членского кошелька (o.mkt.fee), тело — o.mkt.lockp
 * (w.mkt.share → w.mkt.order); недостающую часть взноса пайщик перевёл заранее
 * действием convert (o.mkt.convp) по заявлению 1110.
 * При нехватке — отказ; автоматического добора с паевого Цифрового кошелька нет.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'stockorder'

/**
 * @interface
 */
export type IStockOrder = Marketplace.IStockOrder
