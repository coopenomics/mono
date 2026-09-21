import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Прекращение участия в ЦПП «Образование» по заявлению пайщика об аннулировании соглашения (190):
 * весь остаток кошелька программы
 * уходит в паевой (o.edu.retshr), соглашение о программе аннулируется; подписки к этому моменту закрыты.
 * Отправляет бэкенд ключом кооператива.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'retshare'

/**
 * @interface
 */
export type IRetshare = Edubridge.IRetshare
