import * as Permissions from '../../../common/permissions'
import type * as Capital from '../../../interfaces/capital'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

/**
 * Имя действия
 */
export const actionName = 'approverole'

/**
 * @interface
 */
export type IApproveRole = Capital.IApproverole
