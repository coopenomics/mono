import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawChatcoopSecretaryRoomSelector = {
  id: true,
  displayLabel: true,
  kind: true,
  encrypted: true,
  secretaryInRoom: true,
  editable: true,
}

const _validateSecretaryRoom: MakeAllFieldsRequired<ValueTypes['ChatcoopSecretaryRoom']> =
  rawChatcoopSecretaryRoomSelector

export type ChatcoopSecretaryRoomModel = ModelTypes['ChatcoopSecretaryRoom']

export const chatcoopSecretaryRoomSelector = Selector('ChatcoopSecretaryRoom')(
  rawChatcoopSecretaryRoomSelector,
)
export { rawChatcoopSecretaryRoomSelector }
