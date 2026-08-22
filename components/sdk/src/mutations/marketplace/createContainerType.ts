import { marketplaceContainerTypeSelector } from '../../selectors/marketplace/storageSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateContainerType'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceCreateContainerTypeInput!') },
    marketplaceContainerTypeSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceCreateContainerTypeInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
