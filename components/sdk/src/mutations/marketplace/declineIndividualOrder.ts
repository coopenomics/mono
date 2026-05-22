import { marketplaceSupplierOrderActionResultSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceDeclineIndividualOrder'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceDeclineIndividualOrderInput!') },
    marketplaceSupplierOrderActionResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceDeclineIndividualOrderInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
