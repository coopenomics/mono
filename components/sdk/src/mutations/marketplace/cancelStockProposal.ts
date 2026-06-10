import { marketplaceStockProposalSelector } from '../../selectors/marketplace/stockProposalSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCancelStockProposal'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceResolveStockProposalInput!') },
    marketplaceStockProposalSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceResolveStockProposalInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
