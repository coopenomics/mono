import { rawLedger2HistoryResponseSelector } from '../../selectors/ledger2/ledger2OperationSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'getLedger2History'

export const query = Selector('Query')({
  [name]: [{ input: $('input', 'GetLedger2HistoryInput!') }, rawLedger2HistoryResponseSelector],
})

export interface IInput {
  [key: string]: unknown

  input: ModelTypes['GetLedger2HistoryInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
