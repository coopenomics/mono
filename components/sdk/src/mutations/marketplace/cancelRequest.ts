import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'cancelRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CancelRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CancelRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
