import { marketplaceCartSelector } from '../../selectors/marketplace/cartSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceRemoveFromCart'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceRemoveFromCartInput!') }, marketplaceCartSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceRemoveFromCartInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
