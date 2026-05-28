import { rawChatcoopSecretaryRoomSelector } from '../../selectors/chatcoop/secretaryRoom'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'chatcoopListSecretaryRooms'

export const query = Selector('Query')({
  [name]: rawChatcoopSecretaryRoomSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
