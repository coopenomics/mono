# CoopID — схема audit-событий (`audit_events`)

Канонический контракт аудита аутентификации CoopID. Источник истины для следователя/
compliance: каждое событие безопасности пишется в append-only таблицу `audit_events`
(coop_domain_db) через `AuditService.record`.

> Истории: 8.1 (схема + append-only + партиции), **8.2 (структурированные поля — этот
> документ)**, 8.3/8.4 (проводка OIDC/key-rotation), 8.7 (лог-санитайзер).

## Таблица `audit_events`

Append-only: помесячные партиции `PARTITION BY RANGE`, триггеры запрещают `UPDATE`/`DELETE`/
`TRUNCATE` (`RAISE EXCEPTION 'audit_events is append-only'`). `GRANT INSERT,SELECT` приложению
(`coop_app_user`), `GRANT SELECT` читателю аудита (`coop_audit_reader`). Подробности — миграции
`V2.4.0` + `V2.4.11`.

| Колонка | Тип | Семантика |
|---|---|---|
| `id` | `bigint` IDENTITY | PK (часть с `created_at` для партиции) |
| `event` | `text` NOT NULL | Имя события (см. каталог ниже). **= AC `action`** |
| `subject_id` | `text` | Над кем/над чем событие (пайщик, действие) |
| `actor` | `text` | Кто инициировал (username). Канон CoopID сверх AC |
| `result` | `text` NOT NULL | `success` \| `failure` \| `degraded` |
| `context` | `jsonb` NOT NULL `{}` | Доп. метаданные события. **= AC `metadata`** |
| `ip` | `inet` | IP инициатора, либо `null` |
| `user_agent` | `text` | User-Agent инициатора, либо `null` (Story 8.2) |
| `created_at` | `timestamptz` NOT NULL `now()` | Время. **= AC `timestamp`** |

**Дрейф имён ↔ AC (прав код, см. 8.1):** боевая таблица создана в `V2.4.0` до формализации
AC; имена `event`/`context`/`created_at` сохранены (партиционированная append-only таблица,
~30 точек записи) и семантически равны AC `action`/`metadata`/`timestamp`. `actor` —
дополнительная колонка CoopID (AC отдельного инициатора не выделяет).

## Обязательные поля при записи

`AuditService.record({ event, subjectId?, actor?, result, context?, ip?, userAgent? })`:
- **обязательны**: `event`, `result`;
- остальные — заполняются, когда данные доступны; отсутствующее значение → `null`
  (`subjectId`/`ip`/`userAgent`) либо `{}` (`context`).

## Конвенция explicit-null-with-reason

Если поле физически отсутствует — пишем `null`, а **причину отсутствия** кладём флагом в
`context`. Причину знает только вызывающий (internal call? нет HTTP-заголовка?), поэтому
`AuditService` её НЕ домысливает — это caller-side-конвенция:

```ts
// внутренний вызов без HTTP-контекста: IP неизвестен по причине
await audit.record({
  event: 'coopid.session.revoked_all',
  subjectId: userId,
  result: 'success',
  ip: null,
  context: { ip_unknown: 'internal_call' },
});
```

Так следователь отличает «IP не записали по ошибке» от «IP осознанно отсутствует, потому
что вызов внутренний».

## Инвариант secret-blacklist

`context` НЕ должен содержать секретов. Ключ (на любом уровне вложенности), чьё имя содержит
`password` / `private_key` / `token` / `secret` / `signature`, приводит к `throw` в
`assertContextHasNoSecrets` — это программная ошибка вызывающего, а не повод маскировать.
Поэтому в `context` нельзя называть ключ так, чтобы он попал под blacklist (например, для
хэша подписи использовать `payload_hash`, а не `signature`).

## Каталог имён событий

Self-service / вход:
- `coopid.login.successful` — успешный вход (этап 2 verify-timestamp), `actor`+UA+IP.
- `coopid.verify.timestamp` — проверка подписи timestamp.
- `coopid.auth.degraded` — degraded-вход при недоступном COOPOS (`result: degraded`).
- `coopid.logout` — RP-initiated logout.
- `coopid.session.revoked` / `coopid.session.revoked_all` — отзыв сессии(й).

Recovery / 2FA:
- `coopid.recovery.requested` / `confirmed` / `cancelled` — жизненный цикл recovery.
- `coopid.recovery.strategy_changed` — смена recovery-стратегии.
- `coopid.2fa.enabled` / `coopid.2fa.disabled` — управление TOTP.

Безопасность:
- `coopid.security.account_locked` — escalating-lockout (трекер хэширован).
- `coopid.security.suspicious_login_reported` — «это не я».
- `WeakPasswordRejected` — отклонён слабый пароль при регистрации/смене.

Критические действия (multi-party, Эпик 6):
- `CriticalActionConfirmed` / `CriticalActionExpired` — финализация/истечение (оба подписанта
  + `payload_hash`).
- `ForceRecoveryConsentRequested` / `ForceRecoveryConsentGranted` / `ForceRecoveryAuthorized` /
  `ForceRecoveryDenied` — force-recovery rules.
- `KeyRevokedManually` — ручной отзыв скомпрометированного ключа (`reason`+`chairman_id`).

Назначаемые роли (Story 6.11):
- `CapabilitySetAssigned` / `CapabilitySetRevoked` — назначение/отзыв председателем набора
  возможностей пайщику (`set_key`+`expires_at`; actor=председатель, subject=пайщик).

OIDC-операции (Story 8.3, источник — native-события authentik через webhook):
- `OidcLoginSuccess` — успешный вход (authentik `login`).
- `OidcLogout` — выход (authentik `logout`).
- `OidcTokenIssued` — выдача токена при авторизации приложения (authentik `authorize_application`).
- `Authentik<Action>` — зеркало прочих native-событий authentik (`AuthentikLoginFailed`,
  `AuthentikSuspiciousRequest`, …; result=failure для security-действий). Любое будущее
  подписанное событие потечёт автоматически.
- (отложено) `OidcTokenRevoked`/refresh — в authentik 2026.2 нет надёжного native-action.

Key rotation (`KeyRotated` с цепочкой `RecoveryInitiated`/`RecoveryConfirmed`) — Story 8.4.
