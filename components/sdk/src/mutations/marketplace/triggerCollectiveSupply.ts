import { marketplaceConsolidatedRequestSelector } from '../../selectors/marketplace/consolidatedRequestSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceTriggerCollectiveSupply'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceTriggerCollectiveSupplyInput!') },
    marketplaceConsolidatedRequestSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceTriggerCollectiveSupplyInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
