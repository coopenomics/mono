import { paginatedMarketplaceWriteoffProposalsSelector } from '../../selectors/marketplace/writeoffSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListWriteoffProposals'

export const query = Selector('Query')({
  [name]: [
    {
      data: $('data', 'MarketplaceListWriteoffProposalsInput!'),
      options: $('options', 'PaginationInput'),
    },
    paginatedMarketplaceWriteoffProposalsSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceListWriteoffProposalsInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
