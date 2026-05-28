import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceRemoveAvailableCategories'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'RemoveAvailableCategoriesInput!') }, true],
})

export interface IInput {
  [key: string]: unknown
  input: ModelTypes['RemoveAvailableCategoriesInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
