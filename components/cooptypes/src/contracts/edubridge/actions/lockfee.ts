import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Удержание взноса до конца гарантийного срока курса (процесс p.edu.access):
 * пока срок идёт, участник вправе закрыть подписку с возвратом.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'lockfee'

/**
 * @interface
 */
export type ILockfee = Edubridge.ILockfee
