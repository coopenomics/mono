import { marketplaceKUDetailsSelector } from '../../selectors/marketplace'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceDetailKU'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceDetailKUInput!') }, marketplaceKUDetailsSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceDetailKUInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
