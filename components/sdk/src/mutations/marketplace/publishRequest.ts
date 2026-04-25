import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'publishRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'PublishRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['PublishRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
