import { Cooperative } from 'cooptypes';

/**
 * Идентификаторы оферт расширения marketplace (Стол заказов).
 *
 * Локальный source-of-truth для строковых значений, которые расширение
 * регистрирует в платформенном AgreementRegistry через
 * `register-marketplace-in-agreement-registry.ts` (аналог Capital, Story 1.2).
 *
 * `MARKETPLACE_AGREEMENT_TYPE` совпадает с program-именем в контракте
 * `lib/consts.hpp`: `_marketplace_program = "marketplace"_n` (program_id=2).
 * `_` в `eosio::name` запрещён, поэтому имя без подчёркиваний; см. также
 * `w.mkt.member` (`wallets.generated.ts`) и whitelist `marketplace`-контракта.
 *
 * `MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID` — `document_registry_id` шаблона
 * оферты ЦПП «Стол заказов» в платформенной фабрике документов. Story 1.7
 * разместила шаблон в `cooptypes/cooperative/registry/1100.MarketplaceOfferTemplate`;
 * импортируется отсюда напрямую (по аналогии с Capital + GeneratorOffer/BlagorostOffer).
 */

export const MARKETPLACE_EXTENSION_NAME = 'market';

export const MARKETPLACE_OFFER_AGREEMENT_ID = 'marketplace_offer';

// Ключ выбираемой программы регистрации ЦПП «Стол заказов». Совпадает со
// значением `ProgramKey.MARKETPLACE` ядра (domain/registration/enum) — по нему
// registration-flow генерит персональные номер+дату оферты пайщика в Udata.
export const MARKETPLACE_PROGRAM_KEY = 'MARKETPLACE';

// On-chain имя оферты в `soviet::coagreements`. Контракт принимает eosio::name
// (a-z, 1-5, точка, max 12) — `_` запрещён. Значение совпадает с
// `_marketplace_program = "marketplace"_n` (lib/consts.hpp, program_id=2), иначе
// `get_coagreement_or_fail` падает «Соглашение указанного типа не найдено».
export const MARKETPLACE_AGREEMENT_TYPE = 'marketplace';

// Story 1.7: registry_id шаблона `1100.MarketplaceOfferTemplate` из cooptypes.
// Изменение значения = миграция (новые подписи пайщиков идут на новый template);
// финальная редакция оферты обновит только содержимое 1100.MarketplaceOfferTemplate,
// id остаётся.
export const MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID = Cooperative.Registry.MarketplaceOfferTemplate.registry_id;

// Story 1.7: registry_id инстанса `1101.MarketplaceOffer` — renderуется при
// L2 (Story 1.11) или L3 (Story 1.4) подписании пайщиком.
export const MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID = Cooperative.Registry.MarketplaceOffer.registry_id;
