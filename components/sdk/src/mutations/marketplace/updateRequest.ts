import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'updateRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'UpdateRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['UpdateRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
