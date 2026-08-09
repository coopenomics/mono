import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceReplaceAvailableItems'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'ReplaceAvailableItemsInput!') },
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
  input: ModelTypes['ReplaceAvailableItemsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
