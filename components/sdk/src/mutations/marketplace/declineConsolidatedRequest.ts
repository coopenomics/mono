import { marketplaceConsolidatedRequestActionResultSelector } from '../../selectors/marketplace/consolidatedRequestSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceDeclineConsolidatedRequest'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceDeclineConsolidatedRequestInput!') },
    marketplaceConsolidatedRequestActionResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceDeclineConsolidatedRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
