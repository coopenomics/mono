import { greetingTemplateSelector } from '../../selectors/greetings'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'greetingsSaveTemplate'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'GreetingTemplateInput!') }, greetingTemplateSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GreetingTemplateInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
