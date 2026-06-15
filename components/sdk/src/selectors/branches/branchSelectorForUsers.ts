import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'
import { rawBankAccountSelector } from '../common/bankAccountSelector'
import { rawIndividualCertificateSelector } from '../common/individualCertificateSelector'
import { rawIndividualSelector } from '../common/individualSelector'
import { rawPaymentMethodSelector } from '../paymentMethods/paymentMethodSelector'
import { rawBankPaymentMethodSelector } from '../paymentMethods/rawBankPaymentMethodSelector'

const rawBranchSelectorForUsers = {
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
  bank_account: rawBankPaymentMethodSelector,
  type: true,
  // публичные сертификаты (ФИО) — доступны любому пайщику
  trustee_certificate: rawIndividualCertificateSelector,
  trusted_certificates: rawIndividualCertificateSelector,
  participants_count: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<
  Omit<ValueTypes['Branch'], 'trustee' | 'trusted'>
> = rawBranchSelectorForUsers

export const branchSelectorForUsers = Selector('Branch')(
  rawBranchSelectorForUsers,
)
export { rawBranchSelectorForUsers }
