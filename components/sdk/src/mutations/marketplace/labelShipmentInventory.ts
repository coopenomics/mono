import { marketplaceLabelShipmentInventoryResultSelector } from '../../selectors/marketplace/inventorySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceLabelShipmentInventory'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceLabelShipmentInventoryInput!') },
    marketplaceLabelShipmentInventoryResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceLabelShipmentInventoryInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
