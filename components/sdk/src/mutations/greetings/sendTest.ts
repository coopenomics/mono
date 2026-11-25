import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'greetingsSendTest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'GreetingPreviewInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GreetingPreviewInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
