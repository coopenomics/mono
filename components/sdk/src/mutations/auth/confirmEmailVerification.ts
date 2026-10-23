import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'confirmEmailVerification'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ConfirmEmailVerificationInputDTO!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ConfirmEmailVerificationInputDTO']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
