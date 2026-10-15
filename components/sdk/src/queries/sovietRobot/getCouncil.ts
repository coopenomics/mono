import { robotCouncilSelector } from '../../selectors/sovietRobot'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'sovietRobotCouncil'

/**
 * Совет кооператива: идентификатор, председатель, состав и порог голосов
 */
export const query = Selector('Query')({
  [name]: robotCouncilSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
