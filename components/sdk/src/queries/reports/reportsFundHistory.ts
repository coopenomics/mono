import { rawReportsFundHistoryPaginationSelector } from '../../selectors/reports/fundSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'reportsFundHistory'

/** Движения по фонду за период, по страницам (стол бухгалтера). */
export const query = Selector('Query')({
  [name]: [
    { input: $('input', 'ReportsFundHistoryInput!'), options: $('options', 'PaginationInput') },
    rawReportsFundHistoryPaginationSelector,
  ],
})

export interface IInput {
  [key: string]: unknown

  input: ModelTypes['ReportsFundHistoryInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
