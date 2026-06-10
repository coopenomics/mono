import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Исключение участника из распределения членских взносов КУ: доли остальных
 * перебалансируются автоматически на следующих начислениях.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'delweight'

/**
 * @interface
 */
export type IDelweight = Branch.IDelweight
