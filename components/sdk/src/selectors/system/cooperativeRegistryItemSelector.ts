import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'
import { rawProviderSubscriptionSelector } from './providerSubscriptionSelector'
import { rawCooperativeCharterSelector } from './cooperativeCharterSelector'

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
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CooperativeRegistryItem']> = rawCooperativeRegistryItemSelector

export const cooperativeRegistryItemSelector = Selector('CooperativeRegistryItem')(rawCooperativeRegistryItemSelector)
