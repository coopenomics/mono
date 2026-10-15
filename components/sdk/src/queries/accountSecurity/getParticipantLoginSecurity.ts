import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'getParticipantLoginSecurity'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'ResetParticipantTwoFactorInput!') },
    { totp_enrolled: true, totp_enabled: true },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ResetParticipantTwoFactorInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
