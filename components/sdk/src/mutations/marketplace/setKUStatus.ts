import { marketplaceKUDetailsSelector } from '../../selectors/marketplace'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSetKUStatus'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSetKUStatusInput!') }, marketplaceKUDetailsSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSetKUStatusInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
