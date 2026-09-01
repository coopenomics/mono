import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'requestForceRecoveryConsent'

/**
 * Запросить согласие пайщика на принудительное восстановление (председатель).
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'RequestForceRecoveryConsentInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['RequestForceRecoveryConsentInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
