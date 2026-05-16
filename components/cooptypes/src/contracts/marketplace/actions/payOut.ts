import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Lazy выплата поставщику с расчётного счёта по одному Order'у — отдельный
 * шаг от приёмки (E11 техдолг 598-16, Locked Decision L12). Per-Order:
 * o.mkt.payout (Дт 86 / Кт 51), require_auth(coopname). Срабатывает после
 * подтверждения кассиром фактического банковского перевода. Статус Order'а
 * не меняется; защита от двойного списания — `order.payout_done` on-chain.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'payout'

/**
 * @interface
 */
export type IPayout = Marketplace.IPayout
