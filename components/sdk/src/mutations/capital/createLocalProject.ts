import { projectSelector } from '../../selectors/capital'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalCreateLocalProject'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CreateProjectInput!') }, projectSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CreateProjectInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
