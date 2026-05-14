import { rawGeneratedReportSelector } from '../../selectors/reports/generatedReportSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'generateReportFromEdits'

export const mutation = Selector('Mutation')({
  [name]: [
    {
      reportType: $('reportType', 'ReportType!'),
      year: $('year', 'Int!'),
      period: $('period', 'Int'),
      editsJson: $('editsJson', 'String!'),
    },
    rawGeneratedReportSelector,
  ],
})

export interface IInput {
  [key: string]: unknown

  reportType: ModelTypes['ReportType']
  year: number
  period?: number | null
  editsJson: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
