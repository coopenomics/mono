import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Отсечка персонального распределения членского взноса КУ (requirement b6): доля взноса,
 * распределяемая между председателем и доверенными по весам branch::weights; остальное —
 * в общий кошелёк КУ. Меняет председатель КУ (initiator).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'setsplit'

/**
 * @interface
 */
export type ISetSplit = Marketplace.ISetSplit
