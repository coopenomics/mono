import { marketplaceOutgoingPaymentRequestSelector } from '../../selectors/marketplace/outgoingPaymentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListOutgoingPaymentsAsSupplier'

export const query = Selector('Query')({
  [name]: [
    { statuses: $('statuses', '[MarketplaceOutgoingPaymentRequestStatus!]') },
    marketplaceOutgoingPaymentRequestSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  statuses?: ModelTypes['MarketplaceOutgoingPaymentRequestStatus'][]
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
