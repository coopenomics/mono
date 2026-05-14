import { rawReportRequisitesViewSelector } from '../../selectors/reports/reportRequisitesViewSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'updateReportRequisites'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'UpdateReportRequisitesInput!') }, rawReportRequisitesViewSelector],
})

export interface IInput {
  [key: string]: unknown

  input: ModelTypes['UpdateReportRequisitesInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
