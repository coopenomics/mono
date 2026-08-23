import * as Permissions from '../../../common/permissions'
import type * as Capital from '../../../interfaces/capital'
import { Actors } from '../../../common'

/**
 * Self-callback контракта `capital`. Шасси `expense` шлёт inline action
 * на capital после терминального перехода (CLOSED либо DECLINED).
 * Authority — `capital@active`, не пользователь.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия. Callback от шасси expense на финализацию program-расхода.
 *   status == ExpenseProposalStatus.CLOSED (4)   → списать `total_actual` из
 *     `program_expense_reserved`, остаток вернуть в `program_expense_pool`,
 *     удалить запись `progexpenses`.
 *   status == ExpenseProposalStatus.DECLINED (5) → вернуть весь резерв в пул,
 *     удалить запись.
 */
export const actionName = 'onpgexpdone'

/**
 * @interface
 */
export type IOnProgramExpenseDone = Capital.IOnpgexpdone
