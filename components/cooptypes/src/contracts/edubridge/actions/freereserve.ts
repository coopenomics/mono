import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Высвобождение резерва выплат преподавателям обратно в фонд при отмене
 * подписки (процесс p.edu.access).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'freereserve'

/**
 * @interface
 */
export type IFreereserve = Edubridge.IFreereserve
