import { marketplaceOfferPaginationSelector } from '../../selectors/marketplace/marketplaceOfferPaginationSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListPendingOffers'

export const query = Selector('Query')({
  [name]: [
    { input: $('input', 'MarketplaceListPendingOffersInput') },
    marketplaceOfferPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceListPendingOffersInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
