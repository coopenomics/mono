import { rawLedger2AccountSelector } from '../../selectors/ledger2/ledger2AccountSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'reportsLedgerAccounts'

export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String!') }, rawLedger2AccountSelector],
})

export interface IInput {
  [key: string]: unknown

  coopname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
