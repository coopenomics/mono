import { marketplaceOfferPaginationSelector } from '../../selectors/marketplace/marketplaceOfferPaginationSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListCatalog'

export const query = Selector('Query')({
  [name]: [{ input: $('input', 'MarketplaceListCatalogInput') }, marketplaceOfferPaginationSelector],
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
