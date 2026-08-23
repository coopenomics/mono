import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Заявка на материальную помощь доверенного из его персонального кошелька (requirement b6):
 * заявление получателя → gateway::createoutpay → списание o.brn.aid в aidconfirm.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'createaid'

/**
 * @interface
 */
export type ICreateaid = Branch.ICreateaid
