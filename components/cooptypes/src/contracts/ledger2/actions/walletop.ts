import * as Permissions from '../../../common/permissions'
import type * as Ledger2 from '../../../interfaces/ledger2'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'walletop'

/**
 * @interface
 */
export type IWalletop = Ledger2.IWalletop
