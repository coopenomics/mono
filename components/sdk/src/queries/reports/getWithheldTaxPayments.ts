import { withheldTaxPaymentPageSelector } from '../../selectors/reports/withheldTaxSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getWithheldTaxPayments'

export const query = Selector('Query')({
  [name]: [{ page: $('page', 'Int'), limit: $('limit', 'Int') }, withheldTaxPaymentPageSelector],
})

export interface IInput {
  [key: string]: unknown

  page?: number
  limit?: number
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
