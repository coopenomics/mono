import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказчик размещает заказ на товар из каталога (p.mkt.supply шаг 1, паевая модель).
 * Обеспечительная часть паевого взноса (o.mkt.fee) и тело (o.mkt.lockp) — только со
 * свободного паевого «Стола заказов» (задача 99D-18). Заявления здесь нет: недостающее
 * пайщик транслировал заранее действием convert по заявлению 1110; с Цифрового
 * кошелька без заявления заказ не берёт ничего.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'createorder'

/**
 * @interface
 */
export type ICreateOrder = Marketplace.ICreateOrder
