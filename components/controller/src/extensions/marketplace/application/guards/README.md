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

## `MarketplaceRoleGuard` (Story 1.6)

Ставится **после** `MarketplaceMembershipGuard`. Читает декоратор
`@RequireMarketplaceRole('admin', 'board')` через `Reflector` и проверяет
пересечение (`Array.find(includes)`) с `currentMember.marketplace_roles`.

При запрете:
- бросает `ForbiddenException` с детальным сообщением
  `Forbidden: marketplace role 'admin' required, member has [orderer]`;
- пишет structured log `forbidden-attempt` (`member`, `action`,
  `requested_role`, `actual_marketplace_roles`, `actual_core_roles`).

Если декоратор отсутствует — guard разрешает (по аналогии с core
`RolesGuard`): «нет требования — нет ограничения».

`server-secret` пропускает guard.

## Pattern использования

```typescript
@UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
@RequireMarketplaceRole('admin')
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
| `[User, Member, Chairman]`        | —                     | `[orderer, board_readonly, admin, board]`      |
| `[]` (admin платформы)            | любые                 | `[]` (guard membership уже отбросит 403)       |

## Phase 2 migration (CASL)

Структура Guard остаётся, меняется только источник policy:
`marketplace-roles.mapper.ts` транслируется в платформенный CASL
`defineAbility`, Guard читает CASL-abilities (`ability.can(action, subject)`)
вместо `Array.includes`. Декораторы остаются совместимыми.
Behavior Guard — **тот же**.

Цель этой изоляции: бизнес-код resolver-ов (`@RequireMarketplaceRole('admin')`)
не меняется при переходе на CASL.
