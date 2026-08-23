import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { baseCapitalSelector } from './baseCapitalSelector'

const rawStorySelector = {
  ...baseCapitalSelector,
  coopname: true,
  story_hash: true,
  title: true,
  description: true,
  content_format: true,
  status: true,
  project_hash: true,
  issue_hash: true,
  created_by: true,
  sort_order: true,
  /** Редакция содержимого — передаётся как base_rev при сохранении */
  content_rev: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CapitalStory']> = rawStorySelector

export type storyModel = ModelTypes['CapitalStory']

export const storySelector = Selector('CapitalStory')(rawStorySelector)
export { rawStorySelector }
