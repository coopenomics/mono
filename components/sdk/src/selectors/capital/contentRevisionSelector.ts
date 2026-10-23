import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/** Запись истории редакций без тела (список в окне «Редакции») */
const rawContentRevisionSummarySelector = {
  entity_type: true,
  entity_hash: true,
  rev: true,
  base_rev: true,
  title: true,
  content_hash: true,
  author: true,
  origin: true,
  restored_from_rev: true,
  merged: true,
  description_length: true,
  description_delta: true,
  created_at: true,
}

/** Редакция с телом (просмотр/сравнение) */
const rawContentRevisionSelector = {
  ...rawContentRevisionSummarySelector,
  description: true,
  content_format: true,
}

// Проверка валидности
const _validateSummary: MakeAllFieldsRequired<ValueTypes['CapitalContentRevisionSummary']> = rawContentRevisionSummarySelector
const _validateFull: MakeAllFieldsRequired<ValueTypes['CapitalContentRevision']> = rawContentRevisionSelector

export type contentRevisionSummaryModel = ModelTypes['CapitalContentRevisionSummary']
export type contentRevisionModel = ModelTypes['CapitalContentRevision']

export const contentRevisionSummarySelector = Selector('CapitalContentRevisionSummary')(rawContentRevisionSummarySelector)
export const contentRevisionSelector = Selector('CapitalContentRevision')(rawContentRevisionSelector)
export { rawContentRevisionSelector, rawContentRevisionSummarySelector }
