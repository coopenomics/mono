import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Поставщик акцептует один Order (Story 4.5, p.mkt.supply).
 * Без ledger2-операций — статус active → accepted. Backend проходит циклом per Order.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'acceptorder'

/**
 * @interface
 */
export type IAcceptOrder = Marketplace.IAcceptOrder
