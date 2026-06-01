import { marketplaceInventoryMutationResultSelector } from '../../selectors/marketplace/inventorySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSplitInventory'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceSplitInventoryInput!') },
    marketplaceInventoryMutationResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSplitInventoryInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
