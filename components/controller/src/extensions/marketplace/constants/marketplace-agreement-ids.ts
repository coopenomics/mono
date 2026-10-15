import { Cooperative } from 'cooptypes';
import { ProgramKey } from '@coopenomics/innercoop';

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
 * `w.mkt.share` / `w.mkt.order` (`wallets.generated.ts`) и whitelist `marketplace`-контракта.
 *
 * `MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID` — `document_registry_id` шаблона
 * оферты ЦПП «Стол заказов» в платформенной фабрике документов. Story 1.7
 * разместила шаблон в `cooptypes/cooperative/registry/1100.MarketplaceOfferTemplate`;
 * импортируется отсюда напрямую (по аналогии с Capital + GeneratorOffer/BlagorostOffer).
 */

export const MARKETPLACE_EXTENSION_NAME = 'market';

export const MARKETPLACE_OFFER_AGREEMENT_ID = 'marketplace_offer';

// Ключ выбираемой программы регистрации ЦПП «Стол заказов». Совпадает со
// значением `ProgramKey.MARKETPLACE` из контракта — по нему
// registration-flow генерит персональные номер+дату оферты пайщика в Udata.
export const MARKETPLACE_PROGRAM_KEY = 'MARKETPLACE';

// On-chain имя оферты в `soviet::coagreements`. Контракт принимает eosio::name
// (a-z, 1-5, точка, max 12) — `_` запрещён. Значение совпадает с
// `_marketplace_program = "marketplace"_n` (lib/consts.hpp, program_id=2), иначе
// `get_coagreement_or_fail` падает «Соглашение указанного типа не найдено».
export const MARKETPLACE_AGREEMENT_TYPE = 'marketplace';

// registry_id оферты `1102.MarketplaceOffer`: её подписывает пайщик (L2/L3), и её
// же бланк утверждает совет при подключении ЦПП. Отдельного шаблона «для
// утверждения» (бывший 1101) больше нет. Изменение значения = миграция
// (новые подписи пайщиков идут на новый registry_id); правка текста оферты
// меняет только содержимое 1102, id остаётся.
export const MARKETPLACE_OFFER_INSTANCE_REGISTRY_ID = Cooperative.Registry.MarketplaceOffer.registry_id;
