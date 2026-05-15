import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Backend / админ выносит проект списания скоропорта на повестку совета
 * (Story 8.1, p.mkt.wroff). Создаётся writeoff_proposal в PROPOSED;
 * total_amount = Σ items.amount; все items.executed = false.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'propwroff'

/**
 * @interface
 */
export type IPropWroff = Marketplace.IPropWroff
