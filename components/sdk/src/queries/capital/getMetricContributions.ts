import { metricContributionsPaginationSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalMetricContributions'

export const query = Selector('Query')({
  [name]: [
    {
      data: $('data', 'GetMetricContributionsInput!'),
      options: $('options', 'PaginationInput'),
    },
    metricContributionsPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GetMetricContributionsInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
