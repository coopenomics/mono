import { marketplaceOrderSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceGetOrder'

export const query = Selector('Query')({
  [name]: [{ input: $('input', 'MarketplaceGetOrderInput!') }, marketplaceOrderSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceGetOrderInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
