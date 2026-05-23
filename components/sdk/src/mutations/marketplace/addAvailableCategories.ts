import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAddAvailableCategories'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'AddAvailableCategoriesInput!') },
    {
      id: true,
      categoryId: true,
      typeId: true,
      isActive: true,
      addedBy: true,
      isForEntireCategory: true,
      isForSpecificType: true,
      createdAt: true,
    },
  ],
})

export interface IInput {
  [key: string]: unknown
  input: ModelTypes['AddAvailableCategoriesInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
