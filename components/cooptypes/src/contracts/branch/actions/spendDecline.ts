import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Callback от gateway::outdecline — перевод по расходу КУ не состоялся; средства остаются
 * на общем кошельке КУ, команда помечается отклонённой.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'spenddecline'

/**
 * @interface
 */
export type ISpenddecline = Branch.ISpenddecline
