import { marketplaceInventoryItemSelector } from '../../selectors/marketplace/inventorySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListInventory'

export const query = Selector('Query')({
  [name]: [{ input: $('input', 'MarketplaceListInventoryInput') }, marketplaceInventoryItemSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input?: ModelTypes['MarketplaceListInventoryInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
