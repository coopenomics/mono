import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Резерв социально-экономического обеспечения получателя на участке: сумма
 * материальной помощи в месяц, записанная председателем участка (задача 99D-20).
 * Строка — предел заявлений получателя за месяц и слагаемое расходов участка
 * в расчёте итога месяца Стола заказов. Роль председателя участка проверяет ИСТОК.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'setreserve'

/**
 * @interface
 */
export type ISetreserve = Branch.ISetreserve
