import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Разблокировка удержанного взноса по истечении гарантийного срока курса
 * (процесс p.edu.access): взнос становится свободными средствами программы.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'unlockfee'

/**
 * @interface
 */
export type IUnlockfee = Edubridge.IUnlockfee
