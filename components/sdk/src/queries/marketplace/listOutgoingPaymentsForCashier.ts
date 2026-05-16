import { marketplaceOutgoingPaymentRequestSelector } from '../../selectors/marketplace/outgoingPaymentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListOutgoingPaymentsForCashier'

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

  statuses?: Array<ModelTypes['MarketplaceOutgoingPaymentRequestStatus']>
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
