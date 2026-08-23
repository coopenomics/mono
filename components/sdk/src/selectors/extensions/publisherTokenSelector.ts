import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/** Publisher-токен издателя-пайщика (487-27), без секрета. */
const rawPublisherTokenSelector = {
  id: true,
  username: true,
  label: true,
  tokenPrefix: true,
  createdBy: true,
  createdAt: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['AppsCatalogPublisherToken']> = rawPublisherTokenSelector
export type publisherTokenModel = ModelTypes['AppsCatalogPublisherToken']

export const publisherTokenSelector = Selector('AppsCatalogPublisherToken')(rawPublisherTokenSelector)
export { rawPublisherTokenSelector }
