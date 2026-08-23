import { marketplaceEconomyConfigSelector } from '../../selectors/marketplace/economySelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetEconomyConfig'

export const query = Selector('Query')({
  [name]: marketplaceEconomyConfigSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
