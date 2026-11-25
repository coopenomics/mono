import { greetingMailingOccurrenceSelector } from '../../selectors/greetings'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'greetingsMailings'

export const query = Selector('Query')({
  [name]: [{ year: $('year', 'Int!'), month: $('month', 'Int!') }, greetingMailingOccurrenceSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  year: number
  month: number
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
