import { marketplaceCategoryOfferCountSelector } from '../../selectors/marketplace/categoryOfferCountSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceCategoryOfferCounts'

export const query = Selector('Query')({
  [name]: marketplaceCategoryOfferCountSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
