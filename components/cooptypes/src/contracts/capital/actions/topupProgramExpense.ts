import * as Permissions from '../../../common/permissions'
import type * as Capital from '../../../interfaces/capital'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

/**
 * Имя действия. Пополнение пула программных расходов из доступного остатка
 * `global_available_invest_pool`. Председатель решает сколько денег из
 * инвестиционного пула программы перевести в пул, доступный для расходов.
 */
export const actionName = 'topupprogexp'

/**
 * @interface
 */
export type ITopupProgramExpense = Capital.ITopupprogexp
