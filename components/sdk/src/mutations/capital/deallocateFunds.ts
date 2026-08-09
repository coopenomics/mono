import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalDeallocateFunds'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalDeallocateFundsInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalDeallocateFundsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
