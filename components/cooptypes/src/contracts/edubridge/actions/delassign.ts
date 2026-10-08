import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Снятие допуска преподавателя к курсу (процесс p.edu.teach).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'delassign'

/**
 * @interface
 */
export type IDelassign = Edubridge.IDelassign
