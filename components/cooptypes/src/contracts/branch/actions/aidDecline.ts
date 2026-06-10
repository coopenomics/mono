import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Callback gateway::outdecline — перевод матпомощи не состоялся; средства остаются
 * на персональном кошельке. Auth: _gateway.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'aiddecline'

/**
 * @interface
 */
export type IAiddecline = Branch.IAiddecline
