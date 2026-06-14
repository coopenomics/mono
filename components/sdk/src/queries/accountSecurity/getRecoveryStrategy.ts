import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getRecoveryStrategy'

/**
 * Текущая стратегия восстановления доступа пайщика (enum-значение).
 */
export const query = Selector('Query')({
  [name]: true,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
