import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'setRecoveryStrategy'

/**
 * Сменить стратегию восстановления (требует step-up второго фактора).
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SetRecoveryStrategyInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SetRecoveryStrategyInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
