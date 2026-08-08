import { marketplaceOrderSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListSupplierPickupOrders'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceListSupplierPickupOrdersInput!') },
    marketplaceOrderSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceListSupplierPickupOrdersInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
