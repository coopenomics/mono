import { marketplaceIssuancePickScanSelector } from '../../selectors/marketplace/scanSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceIssuancePickScan'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceIssuancePickScanInput!') },
    marketplaceIssuancePickScanSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceIssuancePickScanInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
