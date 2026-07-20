import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

const rawBankAccountSelector = {
  details: {
    bik: true,
    corr: true,
    // TODO: удалить после 1 августа — legacy-поле, оставлено для совместимости со старыми клиентами
    kpp: true,
  },
  account_number: true,
  bank_name: true,
  card_number: true,
  currency: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['BankAccount']> = rawBankAccountSelector

export const bankAccountSelector = Selector('BankAccount')(rawBankAccountSelector)
export { rawBankAccountSelector }
