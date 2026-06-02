import { marketplaceInventoryMutationResultSelector } from '../../selectors/marketplace/inventorySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAssignInventoryShelf'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceAssignInventoryShelfInput!') },
    marketplaceInventoryMutationResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceAssignInventoryShelfInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
