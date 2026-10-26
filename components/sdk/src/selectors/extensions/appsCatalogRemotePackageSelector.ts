import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/** Подписка кооператива на приложение каталога: состояние, пробный срок, ближайшее списание. */
const rawAppsCatalogSubscriptionSelector = {
  status: true,
  isTrial: true,
  trialEndsAt: true,
  startedAt: true,
  expiresAt: true,
  nextPaymentDue: true,
  amountPerPeriod: true,
}

const _validateSubscription: MakeAllFieldsRequired<ValueTypes['AppsCatalogSubscription']> = rawAppsCatalogSubscriptionSelector

/** Приложение каталога на витрине узла: цена, пробный срок, подписка, фронт и переключатель. */
const rawAppsCatalogRemotePackageSelector = {
  packageId: true,
  publisher: true,
  compatibleSubnets: true,
  lastActiveVersion: true,
  title: true,
  description: true,
  rubPerMonth: true,
  trialDays: true,
  subscription: rawAppsCatalogSubscriptionSelector,
  installed: true,
  enabled: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['AppsCatalogRemotePackageDTO']> = rawAppsCatalogRemotePackageSelector
export type appsCatalogRemotePackageModel = ModelTypes['AppsCatalogRemotePackageDTO']
export type appsCatalogSubscriptionModel = ModelTypes['AppsCatalogSubscription']

export const appsCatalogRemotePackageSelector = Selector('AppsCatalogRemotePackageDTO')(rawAppsCatalogRemotePackageSelector)
export { rawAppsCatalogRemotePackageSelector, rawAppsCatalogSubscriptionSelector }
