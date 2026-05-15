import { marketplaceKUDetailsSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListKUDetails'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'ListMarketplaceKUInput!') }, marketplaceKUDetailsSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ListMarketplaceKUInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
