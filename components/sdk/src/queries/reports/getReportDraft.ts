import { rawReportDraftSelector } from '../../selectors/reports/reportDraftSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'getReportDraft'

export const query = Selector('Query')({
  [name]: [
    {
      reportType: $('reportType', 'ReportType!'),
      year: $('year', 'Int!'),
      period: $('period', 'Int'),
    },
    rawReportDraftSelector,
  ],
})

export interface IInput {
  [key: string]: unknown

  reportType: ModelTypes['ReportType']
  year: number
  period?: number | null
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
