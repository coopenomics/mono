import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceDeleteCustomCategory'

export const mutation = Selector('Mutation')({
  [name]: [{ categoryId: $('categoryId', 'Int!') }, true],
})

export interface IInput {
  [key: string]: unknown
  categoryId: number
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
