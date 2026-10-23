import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Довнесение членского взноса по гарантийному возврату, ждавшему пополнения
 * общего кошелька участка (feepend → ∅, задача 99D-15): o.brn.retfee (общий
 * кошелёк участка → пул взносов) и o.mkt.refund (пул → членский кошелёк
 * программы заказчика); заявка стирается. Участок берётся из заказа. Зовёт
 * бэкенд по расписанию, пока средств на кошельке участка не хватит.
 * require_auth(coopname).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'payretfee'

/**
 * @interface
 */
export type IPayRetFee = Marketplace.IPayRetFee
