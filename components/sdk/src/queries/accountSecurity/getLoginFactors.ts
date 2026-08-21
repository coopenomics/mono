import { loginFactorsSelector } from '../../selectors/accountSecurity/loginFactorsSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getLoginFactors'

/**
 * Настройки подтверждения входа (2FA): какие коды запрашиваются при входе.
 */
export const query = Selector('Query')({
  [name]: loginFactorsSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
