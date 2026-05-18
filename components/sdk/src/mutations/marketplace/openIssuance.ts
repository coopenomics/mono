import { marketplaceIssuanceResultSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceOpenIssuance'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceOpenIssuanceInput!') },
    marketplaceIssuanceResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceOpenIssuanceInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
