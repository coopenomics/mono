import { marketplaceStorageCellSelector } from '../../selectors/marketplace/storageSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceUpdateStorageCell'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceUpdateStorageCellInput!') },
    marketplaceStorageCellSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceUpdateStorageCellInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
