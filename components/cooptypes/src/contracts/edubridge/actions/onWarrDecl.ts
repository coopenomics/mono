import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Обратный вызов от soviet::declinedec / cancelexprd: совет отказал по заявлению
 * об аннулировании подписки по гарантийным условиям либо снял вопрос по сроку
 * (процесс p.edu.access). Заморозка взноса снимается. require_auth(_soviet).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'onwarrdecl'

/**
 * @interface
 */
export type IOnWarrDecl = Edubridge.IOnWarrDecl
