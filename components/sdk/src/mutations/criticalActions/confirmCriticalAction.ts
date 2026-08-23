import { pendingCriticalActionSelector } from '../../selectors/criticalActions/pendingCriticalActionSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'confirmCriticalAction'

/**
 * Подтвердить критическое действие совета (член совета).
 */
export const mutation = Selector('Mutation')({
  [name]: [{ id: $('id', 'String!') }, pendingCriticalActionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
