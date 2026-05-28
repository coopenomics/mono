import { marketplaceOutgoingPaymentRequestSelector } from '../../selectors/marketplace/outgoingPaymentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListOutgoingPaymentsAsSupplier'

export const query = Selector('Query')({
  [name]: [
    { filter: $('filter', 'MarketplaceListOutgoingPaymentsAsSupplierFilterInput') },
    marketplaceOutgoingPaymentRequestSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['MarketplaceListOutgoingPaymentsAsSupplierFilterInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
