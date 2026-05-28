import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawLedger2WalletSelector = {
  id: true,
  name: true,
  available: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['Ledger2Wallet']> = rawLedger2WalletSelector

export type ledger2WalletModel = ModelTypes['Ledger2Wallet']
export const ledger2WalletSelector = Selector('Ledger2Wallet')(rawLedger2WalletSelector)
