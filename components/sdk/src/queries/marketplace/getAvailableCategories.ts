import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetAvailableCategories'

const availableCategorySelector = {
  id: true,
  coopname: true,
  categoryId: true,
  typeId: true,
  isActive: true,
  addedBy: true,
  isForEntireCategory: true,
  isForSpecificType: true,
  createdAt: true,
  updatedAt: true,
} as const

export const query = Selector('Query')({
  [name]: availableCategorySelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
