import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawLedger2AccountSelector = {
  id: true,
  name: true,
  balance: true,
  debitBalance: true,
  creditBalance: true,
  accountType: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['Ledger2Account']> = rawLedger2AccountSelector

export type ledger2AccountModel = ModelTypes['Ledger2Account']
export const ledger2AccountSelector = Selector('Ledger2Account')(rawLedger2AccountSelector)
