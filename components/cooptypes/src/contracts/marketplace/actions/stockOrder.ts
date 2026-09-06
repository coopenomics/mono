import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказ имущества из обезличенного остатка склада кооператива (паевая модель).
 * Продавец — сам кооператив (offerer == coopname); Order рождается сразу в
 * acceptcoop и идёт только через выдачу (readyissue → issuestmt → … → issueact2).
 * Фондируется из свободного паевого «Стола заказов»: o.mkt.lockp (тело,
 * w.mkt.share → w.mkt.order), o.mkt.convp (недостающая часть взноса по заявлению
 * 1110 `convert_statement`, w.mkt.share → w.mkt.member) и o.mkt.fee (взнос с
 * членского кошелька программы).
 * При нехватке — отказ; автоматического добора с паевого Цифрового кошелька нет.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'stockorder'

/**
 * @interface
 */
export type IStockOrder = Marketplace.IStockOrder
