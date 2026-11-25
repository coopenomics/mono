import { marketplaceEconomySettingsSelector } from '../../selectors/marketplace/keuSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetEconomySettings'

export const query = Selector('Query')({
  [name]: marketplaceEconomySettingsSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
