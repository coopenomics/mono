import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/** Набор прав ядра приложения: порты и действия цепи. */
const rawCatalogAppRightsSetSelector = {
  ports: true,
  chainActions: true,
}

const _validateSet: MakeAllFieldsRequired<ValueTypes['CatalogAppRightsSet']> = rawCatalogAppRightsSetSelector

/** Права ядра приложения каталога на узле: что просит версия, что разрешено, что ждёт согласия. */
const rawCatalogAppRightsSelector = {
  packageId: true,
  version: true,
  requested: rawCatalogAppRightsSetSelector,
  granted: rawCatalogAppRightsSetSelector,
  pending: rawCatalogAppRightsSetSelector,
  pendingVersion: true,
  autoAccept: true,
  consentedBy: true,
  consentedAt: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CatalogAppRights']> = rawCatalogAppRightsSelector
export type catalogAppRightsModel = ModelTypes['CatalogAppRights']
export type catalogAppRightsSetModel = ModelTypes['CatalogAppRightsSet']

export const catalogAppRightsSelector = Selector('CatalogAppRights')(rawCatalogAppRightsSelector)
export { rawCatalogAppRightsSelector, rawCatalogAppRightsSetSelector }
