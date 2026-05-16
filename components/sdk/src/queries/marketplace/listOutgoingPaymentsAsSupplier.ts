import { marketplaceOutgoingPaymentRequestSelector } from '../../selectors/marketplace/outgoingPaymentSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListOutgoingPaymentsAsSupplier'

export const query = Selector('Query')({
  [name]: marketplaceOutgoingPaymentRequestSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
