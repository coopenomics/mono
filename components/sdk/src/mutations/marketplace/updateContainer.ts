import { marketplaceContainerSelector } from '../../selectors/marketplace/storageSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceUpdateContainer'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceUpdateContainerInput!') },
    marketplaceContainerSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceUpdateContainerInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
