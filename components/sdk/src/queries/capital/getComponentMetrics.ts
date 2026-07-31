import { rawComponentMetricSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalComponentMetrics'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'GetComponentMetricsInput!') }, rawComponentMetricSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GetComponentMetricsInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
