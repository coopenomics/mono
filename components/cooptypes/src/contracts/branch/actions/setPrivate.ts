import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

/**
 * Имя действия
 */
export const actionName = 'setprivate'

/**
 * @interface
 */
export type ISetPrivate = Branch.ISetprivate
