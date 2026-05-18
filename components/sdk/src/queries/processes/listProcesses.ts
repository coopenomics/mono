import { processSummaryPaginationSelector } from '../../selectors/processes/processSummarySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'processes'

export const query = Selector('Query')({
  [name]: [
    {
      filter: $('filter', 'ProcessesFilter!'),
      pagination: $('pagination', 'PaginationInput!'),
    },
    processSummaryPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter: ModelTypes['ProcessesFilter']
  pagination: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
