import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawChatCoopAccountStatusSelector = {
  hasAccount: true,
  matrixUsername: true,
  iframeUrl: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['MatrixAccountStatusResponseDTO']> = rawChatCoopAccountStatusSelector

export type chatcoopAccountStatusModel = ModelTypes['MatrixAccountStatusResponseDTO']

export const chatcoopAccountStatusSelector = Selector('MatrixAccountStatusResponseDTO')(rawChatCoopAccountStatusSelector)
export { rawChatCoopAccountStatusSelector }

const rawChatCoopCalendarRoomOptionSelector = {
  matrixRoomId: true,
  displayLabel: true,
}

const _validateCalendarRoom: MakeAllFieldsRequired<ValueTypes['ChatCoopCalendarRoomOption']>
  = rawChatCoopCalendarRoomOptionSelector

export type chatCoopCalendarRoomOptionModel = ModelTypes['ChatCoopCalendarRoomOption']

export const chatCoopCalendarRoomOptionSelector = Selector('ChatCoopCalendarRoomOption')(
  rawChatCoopCalendarRoomOptionSelector,
)

const rawChatCoopCalendarEventSelector = {
  id: true,
  matrixRoomId: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  createdByUsername: true,
  icsSequence: true,
  createdAt: true,
  updatedAt: true,
}

const _validateCalendarEvent: MakeAllFieldsRequired<ValueTypes['ChatCoopCalendarEvent']>
  = rawChatCoopCalendarEventSelector

export type chatCoopCalendarEventModel = ModelTypes['ChatCoopCalendarEvent']

export const chatCoopCalendarEventSelector = Selector('ChatCoopCalendarEvent')(rawChatCoopCalendarEventSelector)

const rawChatCoopCalendarIcsUrlSelector = {
  icsUrl: true,
}

const _validateCalendarIcs: MakeAllFieldsRequired<ValueTypes['ChatCoopCalendarIcsUrlResponse']>
  = rawChatCoopCalendarIcsUrlSelector

export const chatCoopCalendarIcsUrlSelector = Selector('ChatCoopCalendarIcsUrlResponse')(
  rawChatCoopCalendarIcsUrlSelector,
)

export * from './projectCommunication'
export * from './secretaryRoom'
// Экспорт селекторов для транскрипций
export * from './transcription'
