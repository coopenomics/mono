import { marketplaceSupplierBatchActionResultSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceDeclineOrdersBatch'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceDeclineOrdersBatchInput!') },
    marketplaceSupplierBatchActionResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceDeclineOrdersBatchInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
