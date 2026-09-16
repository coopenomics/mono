import { marketplaceSupplierClaimResultSelector } from '../../selectors/marketplace/supplierClaimSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAdmitSupplierClaim'

/** Поставщик признаёт гарантийную претензию: сумма удерживается из следующих выплат. */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceAdmitSupplierClaimInput!') }, marketplaceSupplierClaimResultSelector],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceAdmitSupplierClaimInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
