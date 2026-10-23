import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawModerationRequestSelector = {
  id: true,
  packageId: true,
  version: true,
  status: true,
  releaseType: true,
  brief: true,
  scope: true,
  requiresOverride: true,
  submittedBy: true,
  submittedAt: true,
  updatedAt: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['ModerationRequestDTO']> = rawModerationRequestSelector
export type moderationRequestModel = ModelTypes['ModerationRequestDTO']

export const moderationRequestSelector = Selector('ModerationRequestDTO')(rawModerationRequestSelector)
export { rawModerationRequestSelector }
