import { metricSuperpositionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalMetricSuperposition'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'GetMetricSuperpositionInput!') }, metricSuperpositionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GetMetricSuperpositionInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
