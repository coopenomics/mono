import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Преподаватель подписал акт приёма-передачи РИД (первая подпись, процесс p.edu.rid):
 * протокол совета публикуется в реестре, акт уходит председателю на одобрение.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'signridact'

/**
 * @interface
 */
export type ISignRidAct = Edubridge.ISignRidAct
