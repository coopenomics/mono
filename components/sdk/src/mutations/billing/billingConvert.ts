import { billingResultSelector } from '../../selectors/billing/billingResultSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'billingConvert'

/**
 * Конвертация паевого взноса пайщика в членский на биллинг-кошелёк
 * (operation `o.bil.fund`). Требует подписанное пайщиком заявление (document2).
 */
export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'BillingConvertInput!') }, billingResultSelector],
})

export interface IInput {
  input: ModelTypes['BillingConvertInput']
}

export interface IOutput {
  [name]: ModelTypes['BillingResult']
}
