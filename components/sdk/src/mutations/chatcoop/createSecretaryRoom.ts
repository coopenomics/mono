import { rawChatcoopSecretaryRoomSelector } from '../../selectors/chatcoop/secretaryRoom'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'chatcoopCreateSecretaryRoom'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CreateSecretaryRoomInput!') }, rawChatcoopSecretaryRoomSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CreateSecretaryRoomInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
