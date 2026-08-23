import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Callback gateway::outcomplete — кассир подтвердил банковский перевод матпомощи.
 * Auth: _gateway. Здесь применяется o.brn.aid (Дт 86 / Кт 51).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'aidconfirm'

/**
 * @interface
 */
export type IAidconfirm = Branch.IAidconfirm
