import { marketplaceSupplierBatchActionResultSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAcceptOrdersBatch'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceAcceptOrdersBatchInput!') },
    marketplaceSupplierBatchActionResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceAcceptOrdersBatchInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
