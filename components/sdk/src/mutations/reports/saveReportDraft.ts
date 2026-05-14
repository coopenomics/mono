import { rawReportDraftSelector } from '../../selectors/reports/reportDraftSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'saveReportDraft'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'SaveReportDraftInput!') }, rawReportDraftSelector],
})

export interface IInput {
  [key: string]: unknown

  input: ModelTypes['SaveReportDraftInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
