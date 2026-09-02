import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Председатель отказал в подписи договора УХД — коллбэк контракта совета.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._soviet }] as const

export const actionName = 'dclinecontr'

/**
 * @interface
 */
export type IDclinecontr = Edubridge.IDclinecontr
