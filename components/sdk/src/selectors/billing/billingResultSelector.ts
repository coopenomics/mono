import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/**
 * Селектор BillingResult — ответ мутаций billingConvert / billingPay.
 * transactionId — id транзакции в чейне; paymentHash — для billingPay (идентификатор платежа).
 */
export const rawBillingResultSelector = {
  transactionId: true,
  paymentHash: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['BillingResult']> = rawBillingResultSelector

export const billingResultSelector = Selector('BillingResult')(rawBillingResultSelector)

export type BillingResultType = ModelTypes['BillingResult']
