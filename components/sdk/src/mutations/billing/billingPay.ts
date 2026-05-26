import { billingResultSelector } from '../../selectors/billing/billingResultSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'billingPay'

/**
 * Списание стоимости подписок с биллинг-кошелька пайщика в инфраструктурный
 * кошелёк кооператива (operation `o.bil.pay`). Идемпотентно по payment_hash.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'BillingPayInput!') }, billingResultSelector],
})

export interface IInput {
  input: ModelTypes['BillingPayInput']
}

export interface IOutput {
  [name]: ModelTypes['BillingResult']
}
