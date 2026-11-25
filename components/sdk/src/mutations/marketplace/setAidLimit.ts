import { marketplaceEconomySettingsSelector } from '../../selectors/marketplace/keuSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSetAidLimit'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSetAidLimitInput!') }, marketplaceEconomySettingsSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSetAidLimitInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
