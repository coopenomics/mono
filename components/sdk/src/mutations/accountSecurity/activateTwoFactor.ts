import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'activateTwoFactor'

/**
 * Подтвердить подключение второго фактора первым кодом.
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
