import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Преподаватель подписывает приложение к договору на курс (первая подпись); уходит председателю на одобрение.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'signannex'

/**
 * @interface
 */
export type ISignannex = Edubridge.ISignannex
