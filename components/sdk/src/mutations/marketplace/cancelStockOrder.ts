import { marketplaceOrderSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCancelStockOrder'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceCancelStockOrderInput!') }, marketplaceOrderSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceCancelStockOrderInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
