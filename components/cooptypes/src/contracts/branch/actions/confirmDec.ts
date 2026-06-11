import * as Permissions from '../../../common/permissions'
import { Actors } from '../../../common'
import type * as Branch from '../../../interfaces/branch'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._system }] as const

/**
 * Имя действия — учредить участок по решению совета
 */
export const actionName = 'confirmdec'

/**
 * @interface
 */
export type IConfirmDec = Branch.IConfirmdec
