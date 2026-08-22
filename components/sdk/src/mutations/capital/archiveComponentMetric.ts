import { rawComponentMetricSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalArchiveComponentMetric'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ArchiveComponentMetricInput!') }, rawComponentMetricSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ArchiveComponentMetricInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
