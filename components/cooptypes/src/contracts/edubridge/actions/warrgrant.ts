import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Публикация протокола решения совета об удовлетворении заявления по
 * Гарантийным условиям: возврат стоимости проводит `cancelsub` в той же
 * транзакции.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'warrgrant'

/**
 * @interface
 */
export type IWarrgrant = Edubridge.IWarrgrant
