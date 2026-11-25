import { marketplaceEconomySettingsSelector } from '../../selectors/marketplace/keuSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSetInitiatorShare'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSetInitiatorShareInput!') }, marketplaceEconomySettingsSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSetInitiatorShareInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
