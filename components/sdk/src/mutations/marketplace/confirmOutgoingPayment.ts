import { marketplaceOutgoingPaymentResultSelector } from '../../selectors/marketplace/outgoingPaymentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceConfirmOutgoingPayment'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceConfirmOutgoingPaymentInput!') },
    marketplaceOutgoingPaymentResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceConfirmOutgoingPaymentInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
