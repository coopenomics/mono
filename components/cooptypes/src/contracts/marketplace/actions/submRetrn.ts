import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Пайщик подаёт заявление на гарантийный возврат (Story 7.1, p.mkt.return).
 * Без ledger2-операций. Создаётся return_request в pending_review;
 * order.return_request_id ставится для двусторонней связи.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'submretrn'

/**
 * @interface
 */
export type ISubmRetrn = Marketplace.ISubmRetrn
