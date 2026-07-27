import { metricWaveSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalMetricWave'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'GetMetricWaveInput!') }, metricWaveSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GetMetricWaveInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
