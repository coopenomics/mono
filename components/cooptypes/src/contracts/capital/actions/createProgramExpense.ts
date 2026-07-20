import * as Permissions from '../../../common/permissions'
import type * as Capital from '../../../interfaces/capital'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

/**
 * Имя действия. Инициатор программного расхода: резервирует
 * `program_expense_pool` и шлёт inline action в шасси `expense::createexp`
 * с callback handler `{capital, onpgexpdone}`.
 */
export const actionName = 'createpgexp'

/**
 * @interface
 */
export type ICreateProgramExpense = Capital.ICreatepgexp
