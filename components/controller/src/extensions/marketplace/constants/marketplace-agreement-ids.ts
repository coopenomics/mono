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
 * оферты ЦПП «Стол заказов» в платформенной фабрике документов. До тех пор,
 * пока Story 1.7 (one-time platform setup) не выполнена и константа не
 * заменена на реальный `registry_id`, регистрация в AgreementRegistry
 * пропускается с warn-логом — SignUp не предлагает оферту.
 *
 * После Story 1.7 правильное место для значения — `cooptypes`
 * `Cooperative.Registry.MarketplaceOffer.registry_id` (по аналогии с
 * `GeneratorOffer` / `BlagorostOffer`), импортировать оттуда вместо
 * локальной константы. Сейчас держим placeholder, чтобы код был готов к
 * подмене.
 */

export const MARKETPLACE_EXTENSION_NAME = 'market';

export const MARKETPLACE_OFFER_AGREEMENT_ID = 'marketplace_offer';

// On-chain имя оферты в `soviet::coagreements`. Контракт принимает eosio::name
// (a-z, 1-5, точка, max 12) — `_` запрещён. Значение совпадает с
// `_marketplace_program = "marketplace"_n` (lib/consts.hpp, program_id=2), иначе
// `get_coagreement_or_fail` падает «Соглашение указанного типа не найдено».
export const MARKETPLACE_AGREEMENT_TYPE = 'marketplace';

// Placeholder, наполняется в Story 1.7 (one-time platform setup template'а в
// document factory) → правильное место — `Cooperative.Registry.MarketplaceOffer.registry_id`.
export const MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID = 0;
