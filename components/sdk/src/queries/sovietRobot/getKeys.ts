import { robotKeyStatusSelector } from '../../selectors/sovietRobot'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'sovietRobotKeys'

/**
 * Состояние ключей робота у всех членов совета (председатель)
 */
export const query = Selector('Query')({
  [name]: robotKeyStatusSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
