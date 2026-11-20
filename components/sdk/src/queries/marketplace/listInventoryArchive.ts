import { marketplaceInventoryArchiveSelector } from '../../selectors/marketplace/inventorySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListInventoryArchive'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceListInventoryArchiveInput'), options: $('options', 'PaginationInput') },
    marketplaceInventoryArchiveSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data?: ModelTypes['MarketplaceListInventoryArchiveInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
