import { greetingCalendarEntrySelector } from '../../selectors/greetings'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'greetingsUpcoming'

export const query = Selector('Query')({
  [name]: [{ limit: $('limit', 'Int!') }, greetingCalendarEntrySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  limit: number
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
