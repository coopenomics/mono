import { marketplaceSupplierClaimSelector } from '../../selectors/marketplace/supplierClaimSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListSupplierClaims'

/** Гарантийные претензии, выставленные текущему поставщику (99D-13). */
export const query = Selector('Query')({
  [name]: marketplaceSupplierClaimSelector,
})

export interface IInput {
  /** @private */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
