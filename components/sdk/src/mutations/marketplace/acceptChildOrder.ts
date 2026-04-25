import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'acceptChildOrder'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'AcceptChildOrderInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['AcceptChildOrderInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
