import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'declineRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DeclineRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DeclineRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
