import { marketplaceStockProposalAcceptResultSelector } from '../../selectors/marketplace/stockProposalSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceFinalizeStockIssuance'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceFinalizeStockIssuanceInput!') }, marketplaceStockProposalAcceptResultSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceFinalizeStockIssuanceInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
