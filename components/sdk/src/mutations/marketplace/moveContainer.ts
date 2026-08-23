import { marketplaceContainerSelector } from '../../selectors/marketplace/storageSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceMoveContainer'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceMoveContainerInput!') },
    marketplaceContainerSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceMoveContainerInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
