import { marketplaceHandoffCodeSelector } from '../../selectors/marketplace/scanSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceHandoffCode'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceHandoffCodeInput!') },
    marketplaceHandoffCodeSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceHandoffCodeInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
