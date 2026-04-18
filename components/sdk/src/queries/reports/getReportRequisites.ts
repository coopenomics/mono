import { rawReportRequisitesViewSelector } from '../../selectors/reports/reportRequisitesViewSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getReportRequisites'

export const query = Selector('Query')({
  [name]: rawReportRequisitesViewSelector,
})

export interface IInput {
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
