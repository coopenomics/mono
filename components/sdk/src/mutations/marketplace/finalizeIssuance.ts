import { marketplaceIssuanceResultSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceFinalizeIssuance'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceFinalizeIssuanceInput!') },
    marketplaceIssuanceResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceFinalizeIssuanceInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
