import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Продление подписки: новый paid_until строго больше прежнего.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'extendsub'

/**
 * @interface
 */
export type IExtendsub = Edubridge.IExtendsub
