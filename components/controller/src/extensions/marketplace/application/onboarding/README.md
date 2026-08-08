# Онбординг пайщика на Стол заказов

Эпик 1 / Stories 1.2 / 1.4 / 1.7 / 1.9 / 1.10 / 1.11. Backend marketplace
поддерживает трёхуровневую модель онбординга (Locked Decisions L8, L9):
**L1 → L2 → L3**, реализована платформенным паттерном (см.
`reference_trekhurovnevyy_onbording_rasshireniy`).

## L1 — Совет кооператива принимает положение ЦПП

См. **Story 1.9** + **Story 1.10**.

- `Mutation marketplaceAcceptCpp(input)` — председатель кооператива
  фиксирует принятие положения Советом (MVP-stub до FR40 Эпика 8).
- `Query marketplaceCppStatus` — возвращает `active|not_accepted`.
- Side-effect (Story 1.10): re-register оферту в core `AgreementRegistry`
  через `AgreementRegistrationPort`. Идемпотентно по `(id, extension_name)`.
- `Query marketplaceRegistrationOfferStatus` — статус видимости оферты
  в core registration-flow.

Состояние L1 хранится в `extensions.config.coopAcceptance`. До accept
расширение не показывается пайщикам в SignUp.

## L2 — Пайщик при вступлении в кооператив подписывает оферту

См. **Story 1.11**. Backend marketplace для L2 **не вносит нового кода** —
flow обеспечивается:

1. **Core registration-flow** на этапе SignUp читает `AgreementConfigurationService.
   getAgreementsForAccountType(accountType, coopname, programKey?)` и видит
   `marketplace_offer` (Story 1.2/1.7 + side-effect Story 1.10 регистрируют).
2. **Core documentFactory** (AR33) рендерит instance `1101.MarketplaceOffer`
   из `cooptypes/registry` (Story 1.7) с параметрами `{cooperative_params,
   member_params={full_name, account, registration_date}, agreement_date=now()}`.
3. **Core подпись** через `wallet::signagree` (для программных соглашений
   программы=2 «marketplace») или `soviet::sndagreement` (если контракт
   принимает его прямо). On-chain создаётся запись `soviet::agreements3`
   `{username, type:'marketplace', draft_id:1100, document, ...}`.
4. **Core `AgreementSyncService`** наполняет PG-кеш
   `AgreementDomainEntity.findByUsername(username)` синхронизируется
   автоматически.
5. **Story 1.4 `MarketplaceOnboardingService.getOnboardingState`** при
   первом входе пайщика на стол читает PG-кеш и не показывает L3 gate.

## L3 — Локальный fallback gate на самом столе

См. **Story 1.4**. `MarketplaceOnboardingService.getOnboardingState(username)`:

- `MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID ≤ 0` → `{requires_gate:false,
  source:'not_configured'}` — расширение ещё не настроено платформой.
- Подпись есть в `AgreementRepository.findByUsername` с
  `type='marketplace'` + `draft_id=1100` → `{requires_gate:false,
  source:'agreement_signed'}` — L2 или предыдущий L3 покрыл.
- Подписи нет → `{requires_gate:true, source:'gate_required'}` — фронт
  показывает gate-диалог; mutation подписания через L3 будет добавлена
  как фоллоуап story (требует write-mutation pool + sndagreement).

## Что HARD-required от core controller

- `AgreementRegistry` (`AgreementRegistrationPort` + `AgreementQueryPort` +
  `AgreementConfigurationService`) — реализовано (см. `domain/registration/`).
- `AgreementRepository.findByUsername` + `AgreementSyncService` —
  реализовано (`domain/agreement/`, `infrastructure/database/typeorm/blockchain/`).
- `documentFactory.render(registry_id, params)` — реализуется в core
  registration-flow (за пределами marketplace).
- Реальная mutation `wallet::signagree` или `soviet::sndagreement` для
  marketplace — встроена в core registration-flow.

## Что добавит фоллоуап после Эпика 1

- **L3 mutation `marketplaceSignOnboardingOffer`** — pool write-mutation
  для подписи прямо со стола. Реализуется когда нужен сценарий «пайщик
  не выбрал ЦПП при регистрации, подписывает позже».
- **Source-маркер `registration_flow` vs `extension_gate`** в DTO
  `MarketplaceOnboardingState` — потребует локальной таблицы (или metadata
  в `agreements3.document`).
- **Эпик 8 FR40**: Mutation `marketplaceAcceptCpp` валидирует реальную
  повестку совета вместо MVP-stub строки.

## Связанные файлы

- `onboarding/marketplace-onboarding.service.ts` — L3 gate read-service.
- `coop-acceptance/marketplace-coop-acceptance.service.ts` — L1 state + side-effect L1→L2.
- `registration/register-marketplace-in-agreement-registry.ts` — registration в core реестр.
- `resolvers/marketplace-onboarding.resolver.ts` — Query L3.
- `resolvers/marketplace-coop-acceptance.resolver.ts` — Query/Mutation L1.
- `resolvers/marketplace-registration-offer.resolver.ts` — Query видимости в registration-flow.
