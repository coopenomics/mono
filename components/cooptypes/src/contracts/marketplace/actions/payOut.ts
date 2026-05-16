import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Инициация исходящей выплаты поставщику через gateway по одному Order'у
 * (E11 техдолг 598-16, Locked Decision L12). require_auth(coopname). Inline
 * вызовом регистрирует запись в `gateway::outcomes` со статусом pending и
 * привязанными callback'ами `payconfirm` / `paydecline` на marketplace.
 * Ledger2 (Дт 86 / Кт 51) применяется НЕ здесь, а в callback'е `payconfirm`
 * после подтверждения кассиром фактического банковского перевода.
 * `order.payout_status` переходит NONE/DECLINED → PENDING.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'payout'

/**
 * @interface
 */
export type IPayout = Marketplace.IPayout
