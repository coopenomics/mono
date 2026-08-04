import { rawMetricContributionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalLogMetricContribution'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'LogMetricContributionInput!') }, rawMetricContributionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['LogMetricContributionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
