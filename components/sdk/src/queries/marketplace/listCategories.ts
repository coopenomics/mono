import { marketplaceCategorySelector } from '../../selectors/marketplace/offerSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListCategories'

export const query = Selector('Query')({
  [name]: marketplaceCategorySelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
