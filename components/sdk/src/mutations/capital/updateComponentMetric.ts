import { rawComponentMetricSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalUpdateComponentMetric'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'UpdateComponentMetricInput!') }, rawComponentMetricSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['UpdateComponentMetricInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
