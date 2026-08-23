import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawBlockchainAccountSelector } from '../common/blockchainAccountSelector'
import { rawMonoAccountSelector } from './monoAccountSelector'
import { rawParticipantAccountSelector } from './participantAccountSelector'
import { rawPrivateAccountSelector } from './privateAccountSelector'
import { rawUserAccountSelector } from './userAccountSelector'
import { rawRegistrationPaymentSelector } from './registrationPaymentSelector'

const rawAccountSelector = {
  username: true,
  account_kind: true,
  has_password: true,
  blockchain_account: rawBlockchainAccountSelector,
  provider_account: rawMonoAccountSelector,
  participant_account: rawParticipantAccountSelector,
  user_account: rawUserAccountSelector,
  private_account: rawPrivateAccountSelector,
  registration_payment: rawRegistrationPaymentSelector,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['Account']> = rawAccountSelector
export type accountModel = ModelTypes['Account']
export const accountSelector = Selector('Account')(rawAccountSelector)
export { rawAccountSelector }
