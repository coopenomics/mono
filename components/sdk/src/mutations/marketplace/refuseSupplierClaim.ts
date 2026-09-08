import { marketplaceSupplierClaimResultSelector } from '../../selectors/marketplace/supplierClaimSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceRefuseSupplierClaim'

/** Поставщик отказывает по гарантийной претензии с указанием причины. */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceRefuseSupplierClaimInput!') }, marketplaceSupplierClaimResultSelector],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceRefuseSupplierClaimInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
