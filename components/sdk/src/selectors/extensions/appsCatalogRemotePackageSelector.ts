import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawAppsCatalogRemotePackageSelector = {
  packageId: true,
  publisher: true,
  compatibleSubnets: true,
  lastActiveVersion: true,
  title: true,
  description: true,
  rubPerMonth: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['AppsCatalogRemotePackageDTO']> = rawAppsCatalogRemotePackageSelector
export type appsCatalogRemotePackageModel = ModelTypes['AppsCatalogRemotePackageDTO']

export const appsCatalogRemotePackageSelector = Selector('AppsCatalogRemotePackageDTO')(rawAppsCatalogRemotePackageSelector)
export { rawAppsCatalogRemotePackageSelector }
