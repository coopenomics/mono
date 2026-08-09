import { rawIssueMetricBindingSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalSetIssueMetricBindings'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SetIssueMetricBindingsInput!') }, rawIssueMetricBindingSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SetIssueMetricBindingsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
