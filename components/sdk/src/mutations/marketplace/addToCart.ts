import { marketplaceCartSelector } from '../../selectors/marketplace/cartSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAddToCart'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceAddToCartInput!') }, marketplaceCartSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceAddToCartInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
