import { marketplaceSupplierSelector } from '../../selectors/marketplace/supplierSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceMySupplierState'

export const query = Selector('Query')({
  [name]: marketplaceSupplierSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
