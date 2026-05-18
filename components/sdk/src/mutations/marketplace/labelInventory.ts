import { marketplaceLabelInventoryResultSelector } from '../../selectors/marketplace/inventorySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceLabelInventory'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceLabelInventoryInput!') }, marketplaceLabelInventoryResultSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceLabelInventoryInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
