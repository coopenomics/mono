import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawBankAccountSelector } from '../common/bankAccountSelector'

const rawPaymentMethodSelector = {
  data: {
    '__typename': true,
    '...on BankAccount': rawBankAccountSelector,
    '...on SbpAccount': {
      phone: true,
      bank_name: true,
    },
  },
  is_default: true,
  created_at: true,
  updated_at: true,
  method_id: true,
  method_type: true,
  username: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['PaymentMethod']> = rawPaymentMethodSelector

export type paymentMethodModel = ModelTypes['PaymentMethod']
export const paymentMethodSelector = Selector('PaymentMethod')(rawPaymentMethodSelector)
export { rawPaymentMethodSelector }
