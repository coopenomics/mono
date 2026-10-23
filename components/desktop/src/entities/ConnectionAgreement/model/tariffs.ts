/**
 * Epic 28 (форм-фактор §7): тарифы подключения живут в каталоге провайдера
 * (GET /v1/subscription-types через getProviderConnectionCatalog) — статического
 * списка больше нет, см. features/Provider/model/catalog.ts.
 *
 * Шаг выбора показывается всегда: даже с одной конфигурацией пайщик должен
 * видеть, ЗА ЧТО платит (конфигурация, цена, триал, состав услуг).
 */
export const isTariffChoiceAvailable = true
