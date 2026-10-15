import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Отмена подписки с возвратом членского взноса: o.edu.refund и, при возврате по недобору, o.edu.retshr.
 * Отправляет бэкенд ключом кооператива.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'cancelsub'

/**
 * @interface
 */
export type ICancelsub = Edubridge.ICancelsub
