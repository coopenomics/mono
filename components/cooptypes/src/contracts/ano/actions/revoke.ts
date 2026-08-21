import * as Permissions from '../../../common/permissions'
import type * as Ano from '../../../interfaces/ano'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'revoke'

/**
 * @interface
 */
export type IRevoke = Ano.IRevoke
