import { marketplaceCreateExpressReceptionResultSelector } from '../../selectors/marketplace/aplReceptionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateExpressReception'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceCreateExpressReceptionInput!') },
    marketplaceCreateExpressReceptionResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceCreateExpressReceptionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
