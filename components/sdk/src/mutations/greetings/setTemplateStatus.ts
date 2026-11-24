import { greetingTemplateSelector } from '../../selectors/greetings'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'greetingsSetTemplateStatus'

export const mutation = Selector('Mutation')({
  [name]: [{ id: $('id', 'String!'), status: $('status', 'GreetingTemplateStatus!') }, greetingTemplateSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
  status: ModelTypes['GreetingTemplateStatus']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
