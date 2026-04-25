import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'createChildOrder'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CreateChildOrderInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CreateChildOrderInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
