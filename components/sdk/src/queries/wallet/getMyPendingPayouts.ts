import { walletPendingItemSelector } from '../../selectors/wallet/walletActivitySelector'
import { $, type GraphQLTypes, type InputType, Selector, type ModelTypes } from '../../zeus/index'

export const name = 'getMyPendingPayouts'

/** Неисполненные заявки и платежи пайщика: на рассмотрении совета, у кассира, ожидают оплаты. */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'GetMyPendingPayoutsInput!') }, walletPendingItemSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GetMyPendingPayoutsInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
