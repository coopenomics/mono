import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawProviderSubscriptionSelector = {
  id: true,
  subscriber_id: true,
  subscriber_username: true,
  subscription_type_id: true,
  subscription_type_name: true,
  subscription_type_description: true,
  price: true,
  period_days: true,
  instance_username: true,
  status: true,
  started_at: true,
  expires_at: true,
  next_payment_due: true,
  is_trial: true,
  created_at: true,
  updated_at: true,
  // Дополнительные поля для хостинг подписки
  domain_valid: true,
  installation_progress: true,
  instance_status: true,
  specific_data: true,
  // Epic 13 v5.1 — пакетная модель PowerUp:
  // desktop SubscriptionsCard ветка isPackage + ResourceMonitorPage.
  instance_type_id: true,
  kind: true,
  packages_current_period_amount: true,
  package_low_water_axon: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['ProviderSubscription']> = rawProviderSubscriptionSelector

export const providerSubscriptionSelector = Selector('ProviderSubscription')(rawProviderSubscriptionSelector)
