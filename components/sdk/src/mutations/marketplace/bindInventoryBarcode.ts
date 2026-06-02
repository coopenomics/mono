import { marketplaceInventoryMutationResultSelector } from '../../selectors/marketplace/inventorySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceBindInventoryBarcode'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceBindInventoryBarcodeInput!') },
    marketplaceInventoryMutationResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceBindInventoryBarcodeInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
