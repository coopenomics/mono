import { metricSeriesSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalMetricSeries'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'GetMetricSeriesInput!') }, metricSeriesSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GetMetricSeriesInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
