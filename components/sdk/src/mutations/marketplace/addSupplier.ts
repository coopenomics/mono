import { marketplaceSupplierSelector } from '../../selectors/marketplace/supplierSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAddSupplier'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceAddSupplierInput!') }, marketplaceSupplierSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceAddSupplierInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
