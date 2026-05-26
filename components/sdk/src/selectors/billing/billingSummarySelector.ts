import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawBillingSummaryItemSelector = {
  subscriptionId: true,
  subscriptionTypeId: true,
  subscriptionTypeName: true,
  status: true,
  amount: true,
  isFree: true,
}

const _validateItem: MakeAllFieldsRequired<ValueTypes['BillingSummaryItem']> = rawBillingSummaryItemSelector

/**
 * Селектор BillingSummary — сумма к оплате кооператива за период (для реестра
 * кооперативов: сумма/дата след. платежа/free-метки/payment_hash).
 */
export const rawBillingSummarySelector = {
  coopname: true,
  periodDays: true,
  totalAmount: true,
  currency: true,
  paymentHash: true,
  nextPaymentDue: true,
  items: rawBillingSummaryItemSelector,
}

export const billingSummarySelector = Selector('BillingSummary')(rawBillingSummarySelector)

export type BillingSummaryType = ModelTypes['BillingSummary']
