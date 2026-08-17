import { marketplaceTaxStateSelector } from '../../selectors/marketplace/economySelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetTaxState'

export const query = Selector('Query')({
  [name]: marketplaceTaxStateSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
