import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Расчёт итога периода участка (задачи 99D-21, 99D-33): стоимость заказов и
 * собранную обеспечительную часть контракт берёт из своего счётчика участка
 * `kucounters`; узел передаёт факты о расходах, которых в цепи нет, — плановые
 * расходы, служебные записки, выплаченную материальную помощь. Контракт
 * считает членский взнос участка, фонды, долю инициатора, возврат пайщикам и
 * ставки; строка `kuperiods` после записи неизменна, счётчик участка стирается.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'closeperiod'

/**
 * @interface
 */
export type IClosePeriod = Marketplace.IClosePeriod
