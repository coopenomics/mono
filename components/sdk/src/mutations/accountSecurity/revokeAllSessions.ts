import { revokedSessionsResultSelector } from '../../selectors/accountSecurity/revokedSessionsResultSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'revokeAllSessions'

/**
 * Завершить все сессии пайщика.
 */
export const mutation = Selector('Mutation')({
  [name]: revokedSessionsResultSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
