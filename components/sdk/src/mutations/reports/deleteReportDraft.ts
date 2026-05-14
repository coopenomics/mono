import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'deleteReportDraft'

export const mutation = Selector('Mutation')({
  [name]: [{ id: $('id', 'String!') }, true],
})

export interface IInput {
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
