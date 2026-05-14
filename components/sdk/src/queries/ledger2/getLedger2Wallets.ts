import { rawLedger2WalletSelector } from '../../selectors/ledger2/ledger2WalletSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getLedger2Wallets'

export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String!') }, rawLedger2WalletSelector],
})

export interface IInput {
  [key: string]: unknown

  coopname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
