import { accountSessionSelector } from '../../selectors/accountSecurity/accountSessionSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getSessions'

/**
 * Активные сессии текущего пайщика (текущая помечается current).
 */
export const query = Selector('Query')({
  [name]: accountSessionSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
