import { marketplaceSupplierClaimSummarySelector } from '../../selectors/marketplace/supplierClaimSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceSupplierClaimSummary'

/** Сводка претензий поставщика: признанный долг к удержанию, отказано, ожидают ответа. */
export const query = Selector('Query')({
  [name]: marketplaceSupplierClaimSummarySelector,
})

export interface IInput {
  /** @private */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
