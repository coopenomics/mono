import * as Permissions from '../../../common/permissions'
import type * as Wallet from '../../../interfaces/wallet'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'migrate3'

/**
 * @interface
 * Идемпотентная per-record миграция программного соглашения из soviet::agreements3
 * в wallet::users.programs[]. Не путать с ledger2::migrate3 (миграция L3-балансов).
 */
export type IMigrate3 = Wallet.IWalletMigrate3
