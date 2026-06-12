import { marketplaceSupplierPaymentSettingsSelector } from '../../selectors/marketplace/supplierPaymentSettingsSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSetSupplierPayoutMethod'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceSetSupplierPayoutMethodInput!') },
    marketplaceSupplierPaymentSettingsSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceSetSupplierPayoutMethodInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
