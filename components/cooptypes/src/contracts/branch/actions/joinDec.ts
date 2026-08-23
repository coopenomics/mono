import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'
import type * as Branch from '../../../interfaces/branch'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._system }] as const

/**
 * Имя действия — присоединиться к собранию
 */
export const actionName = 'joindec'

/**
 * @interface
 */
export type IJoinDec = Branch.IJoindec
