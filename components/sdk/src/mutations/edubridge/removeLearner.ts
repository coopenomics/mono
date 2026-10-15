import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeRemoveLearner'

export const mutation = Selector('Mutation')({
  [name]: [{ id: $('id', 'ID!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
