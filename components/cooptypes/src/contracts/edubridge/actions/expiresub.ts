import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Истечение подписки: запись стирается (chain-RAM — рабочее состояние, история у парсера).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'expiresub'

/**
 * @interface
 */
export type IExpiresub = Edubridge.IExpiresub
