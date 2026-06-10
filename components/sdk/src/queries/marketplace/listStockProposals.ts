import { marketplaceStockProposalSelector } from '../../selectors/marketplace/stockProposalSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListStockProposals'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceListStockProposalsInput') },
    marketplaceStockProposalSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data?: ModelTypes['MarketplaceListStockProposalsInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
