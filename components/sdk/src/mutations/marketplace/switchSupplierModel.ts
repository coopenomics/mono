import { marketplaceSupplierSelector } from '../../selectors/marketplace/supplierSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSwitchSupplierModel'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceSwitchSupplierModelInput!') },
    marketplaceSupplierSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceSwitchSupplierModelInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
