import { greetingPreviewSelector } from '../../selectors/greetings'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'greetingsPreview'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'GreetingPreviewInput!') }, greetingPreviewSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GreetingPreviewInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
