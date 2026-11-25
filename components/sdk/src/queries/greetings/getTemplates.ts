import { greetingTemplateSelector } from '../../selectors/greetings'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'greetingsTemplates'

export const query = Selector('Query')({
  [name]: greetingTemplateSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
