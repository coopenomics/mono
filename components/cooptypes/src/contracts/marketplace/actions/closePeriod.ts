import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Расчёт итога прогона участка (задача 99D-21): ИСТОК передаёт пять фактов —
 * стоимость заказов прогона, собранную обеспечительную часть, плановые
 * расходы, служебные записки и выплаченную материальную помощь за месяц.
 * Контракт считает членский взнос участка, фонды, долю инициатора, возврат
 * пайщикам и ставки прогона; строка `kuperiods` после записи неизменна.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'closeperiod'

/**
 * @interface
 */
export type IClosePeriod = Marketplace.IClosePeriod
