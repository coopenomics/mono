import { marketplaceOutgoingPaymentRequestSelector } from '../../selectors/marketplace/outgoingPaymentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListOutgoingPayments'

export const query = Selector('Query')({
  [name]: [
    { filter: $('filter', 'MarketplaceListOutgoingPaymentsFilterInput') },
    marketplaceOutgoingPaymentRequestSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['MarketplaceListOutgoingPaymentsFilterInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
