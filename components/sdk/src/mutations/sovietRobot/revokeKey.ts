import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'sovietRobotRevokeKey'

/**
 * Удалить свой ключ из хранилища робота
 */
export const mutation = Selector('Mutation')({
  [name]: true,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
