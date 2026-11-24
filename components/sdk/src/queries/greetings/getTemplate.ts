import { greetingTemplateSelector } from '../../selectors/greetings'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'greetingsTemplate'

export const query = Selector('Query')({
  [name]: [{ id: $('id', 'String!') }, greetingTemplateSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
