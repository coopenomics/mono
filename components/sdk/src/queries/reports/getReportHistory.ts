import { rawReportHistoryPageSelector } from '../../selectors/reports/reportHistoryPageSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'getReportHistory'

export const query = Selector('Query')({
  [name]: [{ filter: $('filter', 'ReportHistoryFilterInput') }, rawReportHistoryPageSelector],
})

export interface IInput {
  [key: string]: unknown

  filter?: ModelTypes['ReportHistoryFilterInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
