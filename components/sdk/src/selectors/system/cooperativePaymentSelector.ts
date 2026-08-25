import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawCooperativePaymentSelector = {
  payment_hash: true,
  quantity: true,
  status: true,
  tx_id: true,
  last_error: true,
  created_at: true,
  updated_at: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CooperativePayment']> = rawCooperativePaymentSelector

export const cooperativePaymentSelector = Selector('CooperativePayment')(rawCooperativePaymentSelector)
