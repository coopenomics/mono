import { rawBillingSummarySelector } from '../../selectors/billing/billingSummarySelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getBillingSummary'

/**
 * Сумма к оплате кооператива за период (стоимость платных подписок, разбивка,
 * дата следующего платежа, payment_hash). Источник — provider backend оператора.
 */
export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String!'), period: $('period', 'Float') }, rawBillingSummarySelector],
})

export interface IInput {
  [key: string]: unknown

  coopname: string
  period?: number
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
