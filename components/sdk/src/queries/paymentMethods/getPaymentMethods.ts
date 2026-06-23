import type { GraphQLTypes, InputType, ModelTypes } from '../../zeus/index'
import { rawPaymentMethodPaginationSelector } from '../../selectors/paymentMethods/paginatedPaymentMethodsSelector'
import { $, Selector } from '../../zeus/index'

export const name = 'getPaymentMethods'

/**
 * Извлекает методы платежа
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'GetPaymentMethodsInput') }, rawPaymentMethodPaginationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GetPaymentMethodsInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
