import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Пакет выплаты отправляется кассиру: inline gateway::createoutpay на сумму пакета, outcome_hash — хэш пакета. Пакет open → sent, сумма больше не меняется.
 * require_auth(coopname).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'sendpayout'

/**
 * @interface
 */
export type ISendpayout = Marketplace.ISendpayout
