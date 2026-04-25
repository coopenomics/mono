import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'completeRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CompleteRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CompleteRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
