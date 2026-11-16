import { marketplaceEconomySettingsSelector } from '../../selectors/marketplace/keuSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSetReturnShare'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSetReturnShareInput!') }, marketplaceEconomySettingsSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSetReturnShareInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
