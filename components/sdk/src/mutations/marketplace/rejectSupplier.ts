import { marketplaceSupplierSelector } from '../../selectors/marketplace/supplierSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceRejectSupplier'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceSupplierMemberInput!') }, marketplaceSupplierSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceSupplierMemberInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
