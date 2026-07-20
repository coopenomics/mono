import { marketplaceCheckoutSignableLineSelector } from '../../selectors/marketplace/cartSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceStockProposalSignablePayloads'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceResolveStockProposalInput!') },
    marketplaceCheckoutSignableLineSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceResolveStockProposalInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
