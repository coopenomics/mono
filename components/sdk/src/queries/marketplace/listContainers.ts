import { marketplaceContainerSelector } from '../../selectors/marketplace/storageSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListContainers'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceListContainersInput') },
    marketplaceContainerSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data?: ModelTypes['MarketplaceListContainersInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
