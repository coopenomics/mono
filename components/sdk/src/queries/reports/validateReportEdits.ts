import { rawFieldErrorSelector } from '../../selectors/reports/fieldErrorSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'validateReportEdits'

export const query = Selector('Query')({
  [name]: [
    {
      reportType: $('reportType', 'ReportType!'),
      editsJson: $('editsJson', 'String!'),
    },
    rawFieldErrorSelector,
  ],
})

export interface IInput {
  [key: string]: unknown

  reportType: ModelTypes['ReportType']
  editsJson: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
