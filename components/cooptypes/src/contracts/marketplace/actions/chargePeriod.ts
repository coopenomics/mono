import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Списание обеспечительной части заказа по ставкам прогона участка (задача
 * 99D-21): участку (o.brn.common, Дт 80 / Кт 86), в фонды накопления
 * (o.fnd.accrue), инициатору (o.mkt.initr), остаток пайщику на свободный
 * паевой (o.mkt.retdue). ИСТОК передаёт остаток обеспечительной части,
 * стоимость заказа и номер прогона; контракт держит потолок остатка
 * кошелька к списанию и делит сумму сам.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'chargeperiod'

/**
 * @interface
 */
export type IChargePeriod = Marketplace.IChargePeriod
