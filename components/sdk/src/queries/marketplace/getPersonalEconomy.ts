import { marketplacePersonalEconomySelector } from '../../selectors/marketplace/economySelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetPersonalEconomy'

export const query = Selector('Query')({
  [name]: marketplacePersonalEconomySelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
