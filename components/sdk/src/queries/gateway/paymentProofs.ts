import { rawPaymentFileSelector } from '../../selectors/gateway/paymentFileSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'paymentProofs'

export const query = Selector('Query')({
  [name]: [
    {
      coopname: $('coopname', 'String!'),
      payment_hash: $('payment_hash', 'String!'),
    },
    rawPaymentFileSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
  payment_hash: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
