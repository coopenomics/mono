import { marketplaceOrderPaginationResultSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListAllOrders'

export const query = Selector('Query')({
  [name]: [
    {
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

  input?: ModelTypes['MarketplaceListOrdersInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
