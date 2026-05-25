import { marketplaceOutgoingPaymentRequestSelector } from '../../selectors/marketplace/outgoingPaymentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListOutgoingPayments'

export const query = Selector('Query')({
  [name]: [
    {
      supplier_account: $('supplier_account', 'String'),
      statuses: $('statuses', '[MarketplaceOutgoingPaymentRequestStatus!]'),
    },
    marketplaceOutgoingPaymentRequestSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  supplier_account?: string
  statuses?: ModelTypes['MarketplaceOutgoingPaymentRequestStatus'][]
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
