import { marketplaceSupplierOrderActionResultSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAcceptIndividualOrder'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceAcceptIndividualOrderInput!') },
    marketplaceSupplierOrderActionResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceAcceptIndividualOrderInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
