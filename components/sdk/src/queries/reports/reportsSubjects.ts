import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'reportsSubjects'

export const query = Selector('Query')({
  [name]: [{ usernames: $('usernames', '[String!]!') }, { username: true, name: true, account_kind: true }],
})

export interface IInput {
  [key: string]: unknown

  usernames: string[]
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
