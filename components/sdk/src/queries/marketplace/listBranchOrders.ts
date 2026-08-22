import { marketplaceOrderPaginationResultSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListBranchOrders'

export const query = Selector('Query')({
  [name]: [
    {
      braname: $('braname', 'String!'),
      input: $('input', 'MarketplaceListOrdersInput'),
      options: $('options', 'PaginationInput'),
    },
    marketplaceOrderPaginationResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  braname: string
  input?: ModelTypes['MarketplaceListOrdersInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
