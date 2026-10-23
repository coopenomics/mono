import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Преподаватель подписывает договор УХД (первая подпись) — процесс p.edu.teach; договор уходит
 * председателю совета на вторую подпись через одобрение.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'signcontract'

/**
 * @interface
 */
export type ISigncontract = Edubridge.ISigncontract
