import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Допуск преподавателя к курсу и его ставка за час на одного участника (процесс p.edu.teach).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'setassign'

/**
 * @interface
 */
export type ISetassign = Edubridge.ISetassign
