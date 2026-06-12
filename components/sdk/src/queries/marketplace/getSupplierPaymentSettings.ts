import { marketplaceSupplierPaymentSettingsSelector } from '../../selectors/marketplace/supplierPaymentSettingsSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetSupplierPaymentSettings'

export const query = Selector('Query')({
  [name]: marketplaceSupplierPaymentSettingsSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
