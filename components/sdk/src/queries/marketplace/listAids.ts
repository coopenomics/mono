import { marketplaceAidSelector } from '../../selectors/marketplace/economySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListAids'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'MarketplaceListAidsInput') }, marketplaceAidSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data?: ModelTypes['MarketplaceListAidsInput'] | null
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
