import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Шаблон поздравления
const rawGreetingTemplateSelector = {
  id: true,
  title: true,
  period_start: true,
  period_end: true,
  subject: true,
  body: true,
  status: true,
  kind: true,
  repeat_yearly: true,
  sent_on: true,
  created_by: true,
  created_at: true,
  updated_at: true,
}
const _validateTemplate: MakeAllFieldsRequired<ValueTypes['GreetingTemplate']> = rawGreetingTemplateSelector
export type greetingTemplateModel = ModelTypes['GreetingTemplate']
export const greetingTemplateSelector = Selector('GreetingTemplate')(rawGreetingTemplateSelector)

// Переменная шаблона
const rawGreetingVariableSelector = {
  variable: true,
  token: true,
  description: true,
  birthdayOnly: true,
}
const _validateVariable: MakeAllFieldsRequired<ValueTypes['GreetingVariableInfo']> = rawGreetingVariableSelector
export type greetingVariableModel = ModelTypes['GreetingVariableInfo']
export const greetingVariableSelector = Selector('GreetingVariableInfo')(rawGreetingVariableSelector)

// Предпросмотр письма
const rawGreetingPreviewSelector = {
  username: true,
  displayName: true,
  age: true,
  subject: true,
  bodyHtml: true,
  unknownVariables: true,
}
const _validatePreview: MakeAllFieldsRequired<ValueTypes['GreetingPreview']> = rawGreetingPreviewSelector
export type greetingPreviewModel = ModelTypes['GreetingPreview']
export const greetingPreviewSelector = Selector('GreetingPreview')(rawGreetingPreviewSelector)

// День рождения в календаре
const rawGreetingCalendarEntrySelector = {
  username: true,
  displayName: true,
  account_type: true,
  month: true,
  day: true,
  date: true,
  age: true,
  send_status: true,
  template_title: true,
}
const _validateEntry: MakeAllFieldsRequired<ValueTypes['GreetingCalendarEntry']> = rawGreetingCalendarEntrySelector
export type greetingCalendarEntryModel = ModelTypes['GreetingCalendarEntry']
export const greetingCalendarEntrySelector = Selector('GreetingCalendarEntry')(rawGreetingCalendarEntrySelector)

// Запись журнала и страница журнала
const rawGreetingSendSelector = {
  id: true,
  username: true,
  displayName: true,
  year: true,
  kind: true,
  occasion_date: true,
  status: true,
  reason: true,
  error: true,
  template_title: true,
  subject: true,
  attempts: true,
  delivery: true,
  created_at: true,
  updated_at: true,
}
const _validateSend: MakeAllFieldsRequired<ValueTypes['GreetingSend']> = rawGreetingSendSelector
export type greetingSendModel = ModelTypes['GreetingSend']
export const greetingSendSelector = Selector('GreetingSend')(rawGreetingSendSelector)

const rawGreetingSendsPaginationSelector = { ...paginationSelector, items: rawGreetingSendSelector }
const _validateSends: MakeAllFieldsRequired<ValueTypes['PaginatedGreetingSendsPaginationResult']> = rawGreetingSendsPaginationSelector
export type greetingSendsPaginationModel = ModelTypes['PaginatedGreetingSendsPaginationResult']
export const greetingSendsPaginationSelector = Selector('PaginatedGreetingSendsPaginationResult')(rawGreetingSendsPaginationSelector)

// Рассылка месяца в календаре
const rawGreetingMailingOccurrenceSelector = {
  template_id: true,
  title: true,
  subject: true,
  date: true,
  repeat_yearly: true,
  status: true,
  completed: true,
  sent: true,
  failed: true,
  delivered: true,
  pending: true,
  undelivered: true,
}
const _validateMailing: MakeAllFieldsRequired<ValueTypes['GreetingMailingOccurrence']> = rawGreetingMailingOccurrenceSelector
export type greetingMailingOccurrenceModel = ModelTypes['GreetingMailingOccurrence']
export const greetingMailingOccurrenceSelector = Selector('GreetingMailingOccurrence')(rawGreetingMailingOccurrenceSelector)
