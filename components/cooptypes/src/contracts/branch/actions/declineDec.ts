import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'
import type * as Branch from '../../../interfaces/branch'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._system }] as const

/**
 * Имя действия — отклонить решением совета
 */
export const actionName = 'declinedec'

/**
 * @interface
 */
export type IDeclineDec = Branch.IDeclinedec
