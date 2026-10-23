# Guards расширения marketplace (Стол заказов)

Локальная реализация security layer marketplace, MVP. Все guards живут
изолированно в `extensions/marketplace/application/guards/` — core не знает
про marketplace-роли.

## `MarketplaceMembershipGuard` (Story 1.3)

1. Требует валидный JWT (через `GqlJwtAuthGuard` выше по цепочке).
2. Проверяет статус пайщика (`users.status === 'active'`, поднимается
   `ParticipantStatusSyncService` по событию `action::soviet::addpartcpnt`).
3. Формирует `IMarketplaceCurrentMember`:
   - `username` — из JWT;
   - `core_roles[]` — из `user.role` через `mapUserRoleToCoreRoles`;
   - `marketplace_roles[]` — из `core_roles` через `mapCoreRolesToMarketplaceRoles`
     (Story 1.6).
4. Кладёт `currentMember` в `request.currentMember` + `ctx.currentMember` для
   `@CurrentMarketplaceMember()`.
5. `server-secret` пропускает guard (inter-service).

## Общий гард прав `RightsGuard` (C28-87)

Ставится **после** `MarketplaceMembershipGuard`. Гард живёт в каркасе
расширений (`@coopenomics/extension-kit`) и общий для всех приложений: он
читает `@RequireRight` операции и сверяет его с описанием прав расширения, в
модуле которого объявлена операция (токен `APP_RIGHTS`). Описание прав Стола
заказов — `access/marketplace-rights.service.ts`: таблица, роли пайщика,
условия строк и справочник объектов. Из него же выдаются права страниц
рабочего стола (`desktopGrantsOf`), отдельного провайдера нет.

Порядок проверки: право по таблице → условие строки → охват.

При отказе гард отвечает кодом и пишет в журнал `forbidden-attempt`:
- право ролям не положено — `KIT_INSUFFICIENT_RIGHTS`;
- условие строки ждёт выполнения — код условия (`MARKETPLACE_COOP_NOT_CONNECTED`,
  `MARKETPLACE_ORDERER_ONBOARDING_REQUIRED`, …);
- объект чужой — код охвата `KIT_RIGHT_SCOPE_*`.

Операция без `@RequireRight` гардом пропускается: членство уже проверил
`MarketplaceMembershipGuard`. `server-secret` пропускает гард.

## Pattern использования

```typescript
@UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
@RequireRight('Offer', 'moderate')
@Mutation(() => SomeDTO)
async marketplaceAdminAction(@CurrentMarketplaceMember() member: IMarketplaceCurrentMember) {
  // member.core_roles, member.marketplace_roles доступны
}
```

## Маппинг ролей

`core-roles.mapper.ts`:

| `user.role` (JWT)  | `core_roles`                       |
|-------------------|-------------------------------------|
| `user`            | `[User]`                            |
| `member`          | `[User, Member]`                    |
| `chairman`        | `[User, Member, Chairman]`          |
| `admin`/unknown   | `[]`                                |

`marketplace-roles.mapper.ts` (аддитивно):

| `core_roles`                       | `+ context`            | `marketplace_roles`                            |
|-----------------------------------|-----------------------|------------------------------------------------|
| `[User]`                          | —                     | `[orderer]`                                    |
| `[User]`                          | `isOfferer: true`     | `[orderer, offerer]` (Эпик 3, whitelist)       |
| `[User]`                          | `isKuChairman: true`  | `[orderer, operator]` (Эпик 2, КУ)             |
| `[User, Member]`                  | —                     | `[orderer, board_readonly]`                    |
| `[User, Member, Chairman]`        | —                     | `[orderer, board_readonly, admin]`             |
| `[]` (admin платформы)            | любые                 | `[]` (guard membership уже отбросит 403)       |

## Таблица прав (Story 1.8, C28-87)

`extensions/marketplace/application/access/marketplace-access-matrix.ts` —
единое место, где описано «какая роль Стола заказов при каких условиях что
может делать с каким ресурсом»: `marketplaceRightsTable`, роль → условия →
право `Ресурс:действие`. Из неё собираются и проверка операции, и набор прав
для страниц рабочего стола.

```ts
// resolver:
@UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
@RequireRight('Issuance', 'create', { of: 'Order', id: 'data.order_id' })
@Mutation(() => MarketplaceOrderDTO)
async marketplaceReadyIssue(...) { ... }
```

Список действий в `@RequireRight('Order', ['read:own', 'read:to-self'])` — «любое из них».

### Охваты

Третья часть имени права из закрытого списка — охват: множество объектов
ресурса, на которые право действует.

| Охват        | Определение                                              | Условие правила                          |
|--------------|----------------------------------------------------------|------------------------------------------|
| `own`        | объекты, которые принадлежат пайщику                     | владелец объекта равен пайщику           |
| `own-KU`     | объекты участков, где пайщик председатель или доверенный | участок объекта входит в эти участки     |
| `chaired-KU` | объекты участков, где пайщик председатель                | участок объекта входит в эти участки     |
| `to-self`    | объекты, которые направлены пайщику                      | получатель объекта равен пайщику         |
| `all`        | все объекты ресурса в кооперативе                        | условия нет; покрывает охваты выше       |

Охват прав, у которых он в имени не записан (`Receiving:create`,
`Issuance:sign:act`), назван в `marketplaceRightScopes`.

### Источник объекта у операции

Охват сверяет guard, а не резолвер. Операция называет третьим аргументом
`@RequireRight`, откуда взять владельца, участок или получателя:

| Источник                              | Когда                                                   |
|---------------------------------------|---------------------------------------------------------|
| `SELF`                                | операция работает с данными вызвавшего: корзина, свои заказы |
| `{ ku: 'data.braname' }`              | участок назван в запросе                                |
| `{ of: 'Order', id: 'data.order_id' }`| объект по номеру (или списку номеров); `match: 'any'` — хватает одного подходящего |
| `{ list: 'data.braname' }`            | список: guard отдаёт операции участки отбора (`@GrantedScope()`) |

Виды объектов и их поля — в `access/marketplace-right-subjects.service.ts`
(справочник объектов: владелец, участок, получатель). Правило каждого охвата
записано один раз в каркасе расширений (`extension-kit/src/auth/rights.ts`)
условием CASL. Отказ по охвату — коды каркаса `KIT_RIGHT_SCOPE_OWN`,
`KIT_RIGHT_SCOPE_OWN_KU`, `KIT_RIGHT_SCOPE_CHAIRED_KU`, `KIT_RIGHT_SCOPE_TO_SELF`.
Объекта нет — guard пропускает запрос, «не найдено» отвечает сама операция.

Гейт `scripts/check-legacy-rights.mjs` требует источник у каждого требования
с узким охватом и запрещает резолверу читать состав участка: частная сверка в
теле операции расходится с таблицей прав и с рабочим столом.
