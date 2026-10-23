import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'
import { rawProviderSubscriptionSelector } from './providerSubscriptionSelector'
import { rawCooperativeCharterSelector } from './cooperativeCharterSelector'
import { rawProviderConnectionCatalogSelector } from './providerConnectionCatalogSelector'

export const rawCooperativeRegistryItemSelector = {
  coopname: true,
  name: true,
  announce: true,
  description: true,
  charter: rawCooperativeCharterSelector,
  status: true,
  created_at: true,
  has_provider_data: true,
  subscriptions: rawProviderSubscriptionSelector,
  // Тариф заявки — те же поля, что у тарифа в каталоге витрины.
  tariff: rawProviderConnectionCatalogSelector.tariffs,
  tariff_billing_period: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CooperativeRegistryItem']> = rawCooperativeRegistryItemSelector

export const cooperativeRegistryItemSelector = Selector('CooperativeRegistryItem')(rawCooperativeRegistryItemSelector)
