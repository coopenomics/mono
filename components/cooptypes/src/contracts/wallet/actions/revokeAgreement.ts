import * as Permissions from '../../../common/permissions'
import type * as Wallet from '../../../interfaces/wallet'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'revokeagree'

/**
 * @interface
 * Расторжение программного соглашения пайщика.
 */
export type IRevokeAgreement = Wallet.IRevokeagree
