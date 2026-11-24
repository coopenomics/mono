import { greetingVariableSelector } from '../../selectors/greetings'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'greetingsVariables'

export const query = Selector('Query')({
  [name]: greetingVariableSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
