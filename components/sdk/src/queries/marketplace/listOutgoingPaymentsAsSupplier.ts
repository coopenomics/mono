import { marketplaceOutgoingPaymentRequestSelector } from '../../selectors/marketplace/outgoingPaymentSelector'
import { type GraphQLTypes, type InputType, Selector, ValueTypes } from '../../zeus/index'

export const name = 'marketplaceListOutgoingPaymentsAsSupplier'

export interface IInput {
  statuses?: ValueTypes['MarketplaceOutgoingPaymentRequestStatus'][]
}

export const query = (input: IInput = {}) =>
  Selector('Query')({
    [name]: [input, marketplaceOutgoingPaymentRequestSelector],
  })

export type IOutput = InputType<GraphQLTypes['Query'], ReturnType<typeof query>>
