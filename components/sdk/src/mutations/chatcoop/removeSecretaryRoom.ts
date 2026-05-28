import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'chatcoopRemoveSecretaryRoom'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'RemoveSecretaryRoomInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['RemoveSecretaryRoomInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
