import { marketplaceCheckoutResultSelector } from '../../selectors/marketplace/cartSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCheckoutCart'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceCheckoutCartInput') }, marketplaceCheckoutResultSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input?: ModelTypes['MarketplaceCheckoutCartInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
