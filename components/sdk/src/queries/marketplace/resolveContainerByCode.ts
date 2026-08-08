import { marketplaceContainerSelector } from '../../selectors/marketplace/storageSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceResolveContainerByCode'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceResolveContainerByCodeInput!') },
    marketplaceContainerSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceResolveContainerByCodeInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
