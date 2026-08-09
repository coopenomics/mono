import * as Permissions from '../../../common/permissions'
import type * as Registrator from '../../../interfaces/registrator'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active, Permissions.special], actor: Actors._admin }] as const

/**
 * Имя действия
 */
export const actionName = 'exitcoop'

/**
 * @interface
 */
export type IExitCoop = Registrator.IExitcoop
