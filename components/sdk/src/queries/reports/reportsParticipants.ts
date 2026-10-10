import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'reportsParticipants'

export const query = Selector('Query')({
  [name]: { username: true, name: true },
})

export interface IInput {
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
