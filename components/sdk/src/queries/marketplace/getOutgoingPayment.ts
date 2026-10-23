import { marketplaceOutgoingPaymentDetailSelector } from '../../selectors/marketplace/outgoingPaymentSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetOutgoingPayment'

export const query = Selector('Query')({
  [name]: [{ id: $('id', 'String!') }, marketplaceOutgoingPaymentDetailSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
