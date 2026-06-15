import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawBankAccountSelector } from '../common/bankAccountSelector'
import { rawIndividualCertificateSelector } from '../common/individualCertificateSelector'
import { rawIndividualSelector } from '../common/individualSelector'
import { rawPaymentMethodSelector } from '../paymentMethods/paymentMethodSelector'
import { rawBankPaymentMethodSelector } from '../paymentMethods/rawBankPaymentMethodSelector'

const rawBranchSelector = {
  coopname: true,
  braname: true,
  city: true,
  country: true,
  details: {
    kpp: true,
    inn: true,
    ogrn: true,
  },
  email: true,
  fact_address: true,
  full_address: true,
  full_name: true,
  phone: true,
  represented_by: {
    based_on: true,
    first_name: true,
    last_name: true,
    middle_name: true,
    position: true,
  },
  short_name: true,
  trusted: rawIndividualSelector, // Передаём "сырой" объект
  trustee: rawIndividualSelector, // Передаём "сырой" объект
  // публичные сертификаты (ФИО) — доступны любому пайщику
  trustee_certificate: rawIndividualCertificateSelector,
  trusted_certificates: rawIndividualCertificateSelector,
  bank_account: rawBankPaymentMethodSelector,
  type: true,
  participants_count: true,
  is_private: true,
  is_available: true,
  // белый список (ФИО) — доступен председателю/совету для управления приватным участком
  whitelist_certificates: rawIndividualCertificateSelector,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['Branch']> = rawBranchSelector

export type branchModel = ModelTypes['Branch']

export const branchSelector = Selector('Branch')(rawBranchSelector)
export { rawBranchSelector }
