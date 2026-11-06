import { marketplaceScanVisitSelector } from '../../selectors/marketplace/scanSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceResolveScan'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceResolveScanInput!') },
    marketplaceScanVisitSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceResolveScanInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
