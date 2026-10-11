import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Обратный вызов от soviet::exec после утверждения протокола 3014 по заявлению
 * об аннулировании подписки по гарантийным условиям (процесс p.edu.access):
 * подписка аннулируется, взнос по ней возвращается участнику. require_auth(_soviet).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'onwarrauth'

/**
 * @interface
 */
export type IOnWarrAuth = Edubridge.IOnWarrAuth
