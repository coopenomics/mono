import { projectSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalCancelProject'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CancelProjectInput!') }, projectSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CancelProjectInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
