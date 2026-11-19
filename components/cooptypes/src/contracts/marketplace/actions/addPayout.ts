import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заказ включается в пакет выплаты поставщику (решение владельца 19.11.2026). Узел в конце дня собирает принятые и ещё не оплаченные заказы поставщика в один пакет — по одному действию на заказ. Контракт прибавляет к пакету принятую стоимость за вычетом удержанного гарантийного долга (o.mkt.deduct + o.mkt.offset). Первое действие с новым хэшем заводит пакет. Заказ: payout_status none/declined → pending.
 * require_auth(coopname).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'addpayout'

/**
 * @interface
 */
export type IAddpayout = Marketplace.IAddpayout
