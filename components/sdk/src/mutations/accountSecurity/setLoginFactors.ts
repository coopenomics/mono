import { loginFactorsSelector } from '../../selectors/accountSecurity/loginFactorsSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'setLoginFactors'

/**
 * Изменить настройки подтверждения входа (изменение фактора приложения требует TOTP-код).
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SetLoginFactorsInput!') }, loginFactorsSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SetLoginFactorsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
