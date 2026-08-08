import { marketplaceOrderSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAnnounceOrderReady'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceAnnounceOrderReadyInput!') }, marketplaceOrderSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceAnnounceOrderReadyInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
