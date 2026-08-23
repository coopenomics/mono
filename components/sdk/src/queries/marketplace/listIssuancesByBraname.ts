import { marketplaceOrderSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListIssuancesByBraname'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceListIssuancesByBranameInput!') },
    marketplaceOrderSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceListIssuancesByBranameInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
