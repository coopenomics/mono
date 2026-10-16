import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

/**
 * Каталог витрины подключения (Epic 28): услуги провайдера и конфигурации
 * сервера с живыми отпускными ценами и триалом, тарифная сетка и годовая
 * оплата (16.10.2026). Закупка/наценка провайдера в схеме отсутствуют by design.
 */
export const rawProviderConnectionCatalogSelector = {
  types: {
    id: true,
    code: true,
    name: true,
    description: true,
    price: true,
    period_days: true,
    is_mandatory: true,
    trial_days: true,
    kind: true,
    depends_on: true,
    is_one_time: true,
  },
  server_options: {
    instance_type_id: true,
    subscription_type_id: true,
    name: true,
    description: true,
    specs: true,
    price: true,
    trial_days: true,
  },
  tariffs: {
    code: true,
    name: true,
    members_limit: true,
    server: { cpu: true, ram_gb: true, price: true },
    support: { price: true, response: true },
    app_price: true,
    docflow_price: true,
    monthly_total: true,
    annual_total: true,
  },
  annual_billing: {
    enabled: true,
    discount_percent: true,
  },
  current_tariff: {
    code: true,
    billing_period: true,
  },
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['ProviderConnectionCatalog']> =
  rawProviderConnectionCatalogSelector

export const providerConnectionCatalogSelector = Selector('ProviderConnectionCatalog')(
  rawProviderConnectionCatalogSelector
)
