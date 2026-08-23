import { marketplaceStockProposalSelector } from '../../selectors/marketplace/stockProposalSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateStockProposal'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceCreateStockProposalInput!') },
    marketplaceStockProposalSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceCreateStockProposalInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
