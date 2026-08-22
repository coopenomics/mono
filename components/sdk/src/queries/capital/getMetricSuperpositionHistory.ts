import { metricSuperpositionHistorySelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalMetricSuperpositionHistory'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'GetMetricSuperpositionHistoryInput!') },
    metricSuperpositionHistorySelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GetMetricSuperpositionHistoryInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
