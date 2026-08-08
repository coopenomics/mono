import { marketplaceStorageCellSelector } from '../../selectors/marketplace/storageSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListStorageCells'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceListStorageCellsInput') },
    marketplaceStorageCellSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data?: ModelTypes['MarketplaceListStorageCellsInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
