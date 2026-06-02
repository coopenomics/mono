import { marketplaceCartSelector } from '../../selectors/marketplace/cartSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceUpdateCartItem'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceUpdateCartItemInput!') }, marketplaceCartSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceUpdateCartItemInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
