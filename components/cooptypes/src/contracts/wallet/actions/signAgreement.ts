import * as Permissions from '../../../common/permissions'
import type * as Wallet from '../../../interfaces/wallet'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'signagree'

/**
 * @interface
 * Подписание программного соглашения пайщиком (Эпик 2 / story 2.1).
 * Document — в action data, не в state.
 */
export type ISignAgreement = Wallet.ISignagree
