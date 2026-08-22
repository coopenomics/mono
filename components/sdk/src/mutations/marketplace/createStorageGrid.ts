import { marketplaceStorageCellSelector } from '../../selectors/marketplace/storageSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateStorageGrid'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceCreateStorageGridInput!') },
    marketplaceStorageCellSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceCreateStorageGridInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
