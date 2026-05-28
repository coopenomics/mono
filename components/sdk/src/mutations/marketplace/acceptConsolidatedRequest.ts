import { marketplaceConsolidatedRequestActionResultSelector } from '../../selectors/marketplace/consolidatedRequestSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAcceptConsolidatedRequest'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceAcceptConsolidatedRequestInput!') },
    marketplaceConsolidatedRequestActionResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceAcceptConsolidatedRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
