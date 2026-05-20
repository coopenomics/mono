import { marketplaceOfferSelector } from '../../selectors/marketplace/offerSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListCatalog'

export const query = Selector('Query')({
  [name]: [
    { input: $('input', 'MarketplaceListCatalogInput') },
    {
      items: marketplaceOfferSelector,
      totalCount: true,
      totalPages: true,
      currentPage: true,
    },
  ],
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
