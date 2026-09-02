import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Председатель подписал договор УХД — коллбэк контракта совета после подтверждения одобрения.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._soviet }] as const

export const actionName = 'apprvcontr'

/**
 * @interface
 */
export type IApprvcontr = Edubridge.IApprvcontr
