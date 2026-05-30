import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'
import { rawProviderSubscriptionSelector } from './providerSubscriptionSelector'

export const rawCooperativeRegistryItemSelector = {
  coopname: true,
  name: true,
  announce: true,
  status: true,
  created_at: true,
  has_provider_data: true,
  subscriptions: rawProviderSubscriptionSelector,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CooperativeRegistryItem']> = rawCooperativeRegistryItemSelector

export const cooperativeRegistryItemSelector = Selector('CooperativeRegistryItem')(rawCooperativeRegistryItemSelector)
