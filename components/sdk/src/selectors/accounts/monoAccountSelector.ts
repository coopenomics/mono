import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawMonoAccountSelector = {
  email: true,
  has_account: true,
  initial_order: true,
  is_email_verified: true,
  is_registered: true,
  message: true,
  public_key: true,
  referer: true,
  role: true,
  status: true,
  type: true,
  username: true,
  subscriber_id: true,
  subscriber_hash: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['MonoAccount']> = rawMonoAccountSelector

export const monoAccountSelector = Selector('MonoAccount')(
  rawMonoAccountSelector,
)
