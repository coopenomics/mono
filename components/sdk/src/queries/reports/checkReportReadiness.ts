import { rawReportReadinessViewSelector } from '../../selectors/reports/reportReadinessViewSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'checkReportReadiness'

export const query = Selector('Query')({
  [name]: [{ reportType: $('reportType', 'ReportType!') }, rawReportReadinessViewSelector],
})

export interface IInput {
  [key: string]: unknown

  reportType: ModelTypes['ReportType']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
