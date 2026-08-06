import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalAllocateFunds'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalAllocateFundsInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalAllocateFundsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
