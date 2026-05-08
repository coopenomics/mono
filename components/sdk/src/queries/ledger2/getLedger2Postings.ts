import { rawLedger2PostingsResponseSelector } from '../../selectors/ledger2/ledger2PostingSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'getLedger2Postings'

export const query = Selector('Query')({
  [name]: [{ input: $('input', 'GetLedger2PostingsInput!') }, rawLedger2PostingsResponseSelector],
})

export interface IInput {
  [key: string]: unknown

  input: ModelTypes['GetLedger2PostingsInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
