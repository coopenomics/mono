import { rawProjectSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalSetProjectPriority'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SetCapitalProjectPriorityInput!') }, rawProjectSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SetCapitalProjectPriorityInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
