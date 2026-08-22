import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'disableTwoFactor'

/**
 * Отключить второй фактор (требует валидный код).
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'TwoFactorCodeInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['TwoFactorCodeInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
