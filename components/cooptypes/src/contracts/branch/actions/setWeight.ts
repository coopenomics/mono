import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Вес участника распределения членских взносов КУ (requirement b6): доля = вес / Σ весов.
 * Назначает председатель КУ; участник — председатель или доверенный участка.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'setweight'

/**
 * @interface
 */
export type ISetweight = Branch.ISetweight
