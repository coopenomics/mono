import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'requestEmailVerification'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'RequestEmailVerificationInputDTO!') },
    { cooldown_seconds: true, expires_seconds: true },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['RequestEmailVerificationInputDTO']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
