import { greetingCalendarEntrySelector } from '../../selectors/greetings'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'greetingsCalendar'

export const query = Selector('Query')({
  [name]: [{ year: $('year', 'Int!'), month: $('month', 'Int!') }, greetingCalendarEntrySelector],
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
