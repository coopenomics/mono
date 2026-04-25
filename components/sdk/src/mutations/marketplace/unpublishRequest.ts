import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'unpublishRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'UnpublishRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['UnpublishRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
