import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'
import type * as Branch from '../../../interfaces/branch'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._system }] as const

/**
 * Имя действия — подать бюллетень
 */
export const actionName = 'votedec'

/**
 * @interface
 */
export type IVoteDec = Branch.IVotedec
