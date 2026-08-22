import { twoFactorEnrollmentSelector } from '../../selectors/accountSecurity/twoFactorEnrollmentSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'enrollTwoFactor'

/**
 * Начать подключение второго фактора: выпустить секрет и otpauth-URI для QR.
 */
export const mutation = Selector('Mutation')({
  [name]: twoFactorEnrollmentSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
