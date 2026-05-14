import * as Permissions from '../../../common/permissions'
import type * as Ledger2 from '../../../interfaces/ledger2'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'walmove'

/**
 * @interface
 */
export type IWalmove = Ledger2.IWalmove
