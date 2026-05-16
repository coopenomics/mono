import { marketplaceCreateOrderResultSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateOrder'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceCreateOrderInput!') }, marketplaceCreateOrderResultSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceCreateOrderInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
