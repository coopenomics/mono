import { rawComponentMetricSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalCreateComponentMetric'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CreateComponentMetricInput!') }, rawComponentMetricSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CreateComponentMetricInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
