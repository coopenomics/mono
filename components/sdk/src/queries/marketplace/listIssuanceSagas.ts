import { marketplaceIssuanceSagaSelector } from '../../selectors/marketplace/issuanceSagaSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListIssuanceSagas'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'MarketplaceListIssuanceSagasInput') }, marketplaceIssuanceSagaSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data?: ModelTypes['MarketplaceListIssuanceSagasInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
