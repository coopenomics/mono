import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'resetParticipantTwoFactor'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ResetParticipantTwoFactorInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ResetParticipantTwoFactorInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
