import { marketplaceSupplierClaimSelector } from '../../selectors/marketplace/supplierClaimSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceSupplierClaim'

/** Одна гарантийная претензия с рекламацией в две подписи, фото и пройденными шагами. */
export const query = Selector('Query')({
  [name]: [{ claim_id: $('claim_id', 'String!') }, marketplaceSupplierClaimSelector],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  claim_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
