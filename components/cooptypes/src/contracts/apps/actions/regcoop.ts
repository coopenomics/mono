import * as Permissions from '../../../common/permissions'
import type * as Apps from '../../../interfaces/apps'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'regcoop'

/**
 * @interface
 */
export type IRegcoop = Apps.IRegcoop
