import { marketplaceCategoryOfferCountSelector } from '../../selectors/marketplace/categoryOfferCountSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceCategoryOfferCounts'

export const query = Selector('Query')({
  [name]: [
    { delivery_braname: $('delivery_braname', 'String') },
    marketplaceCategoryOfferCountSelector,
  ],
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
