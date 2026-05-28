import { rawChatcoopNonProjectCommunicationRoomSelector } from '../../selectors/chatcoop/projectCommunication'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'chatcoopListNonProjectCommunicationRooms'

export const query = Selector('Query')({
  [name]: rawChatcoopNonProjectCommunicationRoomSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
