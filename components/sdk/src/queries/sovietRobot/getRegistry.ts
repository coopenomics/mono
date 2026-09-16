import { robotDecisionTypeSelector } from '../../selectors/sovietRobot'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'sovietRobotRegistry'

/**
 * Реестр действий автоматизации: кто и что делегировал роботу по каждому типу решения и достигнут ли кворум робота
 */
export const query = Selector('Query')({
  [name]: robotDecisionTypeSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
