import { marketplaceStorageCellSelector } from '../../selectors/marketplace/storageSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateStorageCell'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceCreateStorageCellInput!') },
    marketplaceStorageCellSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceCreateStorageCellInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
