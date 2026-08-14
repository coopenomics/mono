import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Callback gateway::outcomplete — кассир подтвердил перечисление налога в бюджет.
 * Auth: _gateway. Здесь применяется o.brn.taxpay (Дт 68 / Кт 51).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'taxconfirm'

/**
 * @interface
 */
export type ITaxconfirm = Branch.ITaxconfirm
