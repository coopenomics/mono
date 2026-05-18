import { marketplaceOrderSelector } from '../../selectors/marketplace/orderSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListMyReadyToReceive'

export const query = Selector('Query')({
  [name]: marketplaceOrderSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
