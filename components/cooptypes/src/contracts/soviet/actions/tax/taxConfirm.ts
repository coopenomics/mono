import * as Permissions from '../../../../common/permissions'
import type * as Soviet from '../../../../interfaces/soviet'
import { Actors } from '../../../../common'

/**
 * Callback gateway::outcomplete — кассир подтвердил перечисление налога в бюджет.
 * Auth: _gateway. Здесь применяется o.sov.taxpay (Дт 68 / Кт 51).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'taxconfirm'

/**
 * @interface
 */
export type ITaxconfirm = Soviet.ITaxconfirm
