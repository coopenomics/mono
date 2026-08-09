import { marketplaceSupplierSelector } from '../../selectors/marketplace/supplierSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceRequestSupplier'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceRequestSupplierInput!') }, marketplaceSupplierSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceRequestSupplierInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
