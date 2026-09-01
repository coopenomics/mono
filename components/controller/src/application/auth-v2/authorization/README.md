# CASL-авторизация auth-v2 (Эпик 6)

Реальный `@casl/ability`-фундамент авторизации платформы. Заменяет роле-ориентированный
`@AuthRoles` на capability-ориентированный `can(action, Subject)` (Layered Authorization Pattern).

## Слои (Эпик 6)

| Layer | Что | Story |
|-------|-----|-------|
| 1 — Static Ability | `AbilityFactory.createForParticipant` собирает Ability из core-ролей по статической матрице | 6.1 (этот код) |
| 2 — `access_rules` matrix | декларативные allow/deny из БД мерджатся в Ability; инвалидация активных сессий через Redis pub/sub | 6.2 |
| 3 — PolicyHandler registry | политики с DB-lookup (`@PolicyHandler('same-coop-voting')`) | 6.3 |
| 4 — `AuthorizationGuard` | единый guard на все 4 слоя; HTTP REST + GraphQL; читает Ability из session-стора | 6.4 |

## Роли (канон платформы)

`CoreRole = 'User' | 'Member' | 'Chairman'` (`core-roles.ts`), маппинг из `user.role` JWT.
Иерархия аддитивна: Chairman ⊃ Member ⊃ User. Это существующий канон контроллера
(CLAUDE.md «3 базовые роли») — НЕ вводить синонимы `participant`/`council_member`.

## Матрица Layer 1 (статическая)

| Субъект | User (пайщик) | Member (совет) | Chairman (председатель) |
|---------|---------------|----------------|--------------------------|
| Certificate | read (свой) | — | — |
| Session | read/update (свои) | — | — |
| RecoveryStrategy | manage (своя, вкл. 2FA) | — | — |
| Participant | — | read | update (роли, 6.6) |
| VerificationRule | — | read | manage |
| CoopSettings | — | — | manage |
| CriticalAction | — | read + **confirm** (6.8) | + create (инициатор) |
| Capability | — | — | create (6.7) |
| AuditEvent | — | read | (наследует) |

Критические действия (исключение, смена ролей совета, force-recovery) финализируются только
двумя подписями (Story 6.8) — Chairman инициирует (`create`), Member подтверждает (`confirm`).

## Контракт миграции marketplace-matrix → эта CASL

На ветке `marketplace2` есть CASL-совместимый зачаток
(`extensions/marketplace/application/access/marketplace-access-matrix.ts`,
`Record<role, Record<resource, action[]>>` + `canAccess`) с пометкой «Phase 2 → CASL `defineAbility`».
Платформенный дом этой миграции — **здесь**. Правила трансляции:

- `Resource:action` (например `Order:create`) → `can('create', 'Order')`.
- Квалификаторы охвата `:own` / `:own-KU` / `:to-self` → CASL `conditions`
  (`can('read', 'Order', { owner: username })` вместо ручной проверки в resolver'е).
- `:all` (надмножество) → правило без condition; иерархия охвата (`:all` удовлетворяет `:own`)
  в CASL выражается естественно: правило без условия матчит любой экземпляр.
- `manage` — тот же CASL-wildcard.
- Развёртка грантов для фронта (`marketplace-grants.ts` `expandGrantsForRoles`) →
  `@casl/ability/extra` `permittedFieldsOf` / прямой обход `ability.rules` для `meta.requires`.

Marketplace-домен (ресурсы Order/Offer/KU…) остаётся в своём расширении и переключает источник
policy на эту платформенную CASL без правки call-site guard'ов (interface сохраняется). Перенос —
задача ветки marketplace, не Эпика 6 (так обе ветки мерджатся в dev без конфликтов файлов).
