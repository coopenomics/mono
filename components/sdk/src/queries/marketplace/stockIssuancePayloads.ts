import { marketplaceStockIssuanceOperatorLineSelector } from '../../selectors/marketplace/stockProposalSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceStockIssuancePayloads'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'MarketplaceStockIssuancePrepareInput!') }, marketplaceStockIssuanceOperatorLineSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceStockIssuancePrepareInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
