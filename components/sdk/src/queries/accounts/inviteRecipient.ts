import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'inviteRecipient'

/**
 * Почта приглашённого по токену из письма-приглашения. Токен не расходуется.
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'InviteRecipientInput!') }, { email: true }],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['InviteRecipientInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
