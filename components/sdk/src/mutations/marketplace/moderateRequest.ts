import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'moderateRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ModerateRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ModerateRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
