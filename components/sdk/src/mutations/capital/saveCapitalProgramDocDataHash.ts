import { capitalOnboardingStateSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus'

export const name = 'saveCapitalProgramDocDataHash'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SaveCapitalProgramDocDataInput!') }, capitalOnboardingStateSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SaveCapitalProgramDocDataInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
