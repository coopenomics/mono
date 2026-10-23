import { robotKeyStatusSelector } from '../../selectors/sovietRobot'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'sovietRobotDelegateKey'

/**
 * Передать роботу приватный ключ своего разрешения; ключ проверяется по цепи и хранится зашифрованным
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'RobotDelegateKeyInput!') }, robotKeyStatusSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['RobotDelegateKeyInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
