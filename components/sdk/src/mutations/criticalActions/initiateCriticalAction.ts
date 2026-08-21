import { pendingCriticalActionSelector } from '../../selectors/criticalActions/pendingCriticalActionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'initiateCriticalAction'

/**
 * Инициировать критическое действие совета (председатель).
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'InitiateCriticalActionInput!') }, pendingCriticalActionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['InitiateCriticalActionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
