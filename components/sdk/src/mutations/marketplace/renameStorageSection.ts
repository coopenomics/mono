import { marketplaceStorageCellSelector } from '../../selectors/marketplace/storageSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceRenameStorageSection'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceRenameStorageSectionInput!') },
    marketplaceStorageCellSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceRenameStorageSectionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
