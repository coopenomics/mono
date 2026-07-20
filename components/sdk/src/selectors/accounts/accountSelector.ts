import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawBlockchainAccountSelector } from '../common/blockchainAccountSelector'
import { rawMonoAccountSelector } from './monoAccountSelector'
import { rawParticipantAccountSelector } from './participantAccountSelector'
import { rawPrivateAccountSelector } from './privateAccountSelector'
import { rawUserAccountSelector } from './userAccountSelector'

const rawAccountSelector = {
  username: true,
  account_kind: true,
  blockchain_account: rawBlockchainAccountSelector,
  provider_account: rawMonoAccountSelector,
  participant_account: rawParticipantAccountSelector,
  user_account: rawUserAccountSelector,
  private_account: rawPrivateAccountSelector,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['Account']> = rawAccountSelector
export type accountModel = ModelTypes['Account']
export const accountSelector = Selector('Account')(rawAccountSelector)
export { rawAccountSelector }
