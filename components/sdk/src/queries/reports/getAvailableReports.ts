import { rawAvailableReportSelector } from '../../selectors/reports/availableReportSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getAvailableReports'

export const query = Selector('Query')({
  [name]: rawAvailableReportSelector,
})

export interface IInput {
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
