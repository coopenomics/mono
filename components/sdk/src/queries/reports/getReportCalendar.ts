import { rawReportCalendarRowSelector } from '../../selectors/reports/reportCalendarSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getReportCalendar'

export const query = Selector('Query')({
  [name]: [{ year: $('year', 'Int!') }, rawReportCalendarRowSelector],
})

export interface IInput {
  [key: string]: unknown

  year: number
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
