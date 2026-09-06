import { robotDecisionSelector } from '../../selectors/sovietRobot'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'sovietRobotRetryDecision'

/**
 * Повторить обработку застрявшего решения
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'RobotRetryDecisionInput!') }, robotDecisionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['RobotRetryDecisionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
