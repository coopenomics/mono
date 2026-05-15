import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Совет отклоняет проект списания скоропорта целиком (Story 8.3, p.mkt.wroff).
 * Без ledger2-операций. Status PROPOSED → REJECTED. Отклонить можно только если
 * ни одна позиция ещё не исполнена через execwroff.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._chairman }] as const

export const actionName = 'declwroff'

/**
 * @interface
 */
export type IDeclWroff = Marketplace.IDeclWroff
