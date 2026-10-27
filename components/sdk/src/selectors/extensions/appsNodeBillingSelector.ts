import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/** Подписка кооператива у провайдера подключения, как её показывает узел. */
const rawAppsNodeSubscriptionSelector = {
  id: true,
  name: true,
  code: true,
  kind: true,
  packageId: true,
  status: true,
  isTrial: true,
  price: true,
  periodDays: true,
  startedAt: true,
  expiresAt: true,
  nextPaymentDue: true,
}

const _validateSubscription: MakeAllFieldsRequired<ValueTypes['AppsNodeSubscription']> = rawAppsNodeSubscriptionSelector

const rawAppsNodeWalletSelector = {
  membershipAvailable: true,
  axonAvailable: true,
}

const _validateWallet: MakeAllFieldsRequired<ValueTypes['AppsNodeWallet']> = rawAppsNodeWalletSelector

/** Подписки, счёт и кошелёк кооператива у провайдера — только для показа. */
const rawAppsNodeBillingSelector = {
  available: true,
  operator: true,
  operatorSite: true,
  subscriptions: rawAppsNodeSubscriptionSelector,
  monthlyTotal: true,
  dueAmount: true,
  nextPaymentDue: true,
  wallet: rawAppsNodeWalletSelector,
}

const _validate: MakeAllFieldsRequired<ValueTypes['AppsNodeBilling']> = rawAppsNodeBillingSelector
export type appsNodeBillingModel = ModelTypes['AppsNodeBilling']
export type appsNodeSubscriptionModel = ModelTypes['AppsNodeSubscription']

export const appsNodeBillingSelector = Selector('AppsNodeBilling')(rawAppsNodeBillingSelector)
export { rawAppsNodeBillingSelector, rawAppsNodeSubscriptionSelector, rawAppsNodeWalletSelector }
