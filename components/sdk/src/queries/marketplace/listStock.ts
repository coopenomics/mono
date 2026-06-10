import { marketplaceInventoryItemSelector } from '../../selectors/marketplace/inventorySelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListStock'

export const query = Selector('Query')({
  [name]: [{ braname: $('braname', 'String') }, marketplaceInventoryItemSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  braname?: string | null
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
