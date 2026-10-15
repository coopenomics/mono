import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'reportsParticipantWallets'

export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String!') }, { username: true, program_id: true, available: true }],
})

export interface IInput {
  [key: string]: unknown

  coopname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
