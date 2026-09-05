import { robotKeyStatusSelector } from '../../selectors/sovietRobot'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'sovietRobotKeyStatus'

/**
 * Состояние ключа робота текущего члена совета
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
