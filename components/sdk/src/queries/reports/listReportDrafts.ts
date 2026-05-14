import { rawReportDraftSelector } from '../../selectors/reports/reportDraftSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'listReportDrafts'

export const query = Selector('Query')({
  [name]: [
    { filter: $('filter', 'ListReportDraftsFilterInput') },
    rawReportDraftSelector,
  ],
})

export interface IInput {
  [key: string]: unknown

  filter?: ModelTypes['ListReportDraftsFilterInput'] | null
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
