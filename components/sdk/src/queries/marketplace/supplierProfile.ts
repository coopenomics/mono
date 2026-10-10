import { marketplaceSupplierProfileSelector } from '../../selectors/marketplace/supplierProfileSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceSupplierProfile'

/** Профиль поставщика: имя, рассказ о себе, обложка, число предложений и сводная оценка. */
export const query = Selector('Query')({
  [name]: [{ supplier_account: $('supplier_account', 'String!') }, marketplaceSupplierProfileSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  supplier_account: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
