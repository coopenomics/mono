import { marketplaceOutgoingPaymentResultSelector } from '../../selectors/marketplace/outgoingPaymentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceBlockOutgoingPayment'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceBlockOutgoingPaymentInput!') },
    marketplaceOutgoingPaymentResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceBlockOutgoingPaymentInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
