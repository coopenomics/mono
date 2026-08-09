import { marketplaceStorageCellSelector } from '../../selectors/marketplace/storageSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceRetireStorageCells'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceRetireStorageCellsInput!') },
    marketplaceStorageCellSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceRetireStorageCellsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
