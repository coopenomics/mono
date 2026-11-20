import { marketplaceInventoryMovementSelector } from '../../selectors/marketplace/inventorySelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceInventoryMovements'

export const query = Selector('Query')({
  [name]: [{ inventory_id: $('inventory_id', 'String!') }, marketplaceInventoryMovementSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  inventory_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
