import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Обратный вызов от soviet::exec после утверждения протокола 3009 по заявлению
 * о паевом взносе результатом интеллектуальной деятельности (процесс p.edu.rid).
 * Движений средств нет: паевой фонд признаётся позже, по акту приёма-передачи. require_auth(_soviet).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'onridauth'

/**
 * @interface
 */
export type IOnRidAuth = Edubridge.IOnRidAuth
