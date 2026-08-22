import { marketplaceInventoryMutationResultSelector } from '../../selectors/marketplace/inventorySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAssignInventoryPlacement'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceAssignInventoryPlacementInput!') },
    marketplaceInventoryMutationResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceAssignInventoryPlacementInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
