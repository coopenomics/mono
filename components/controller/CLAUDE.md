---
project_name: 'Платформа Цифрового Кооператива — Синхронизация узла с блокчейном'
user_name: 'ant'
date: '2026-04-24'
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - composite_entity
  - dispatch_pipeline
  - write_mutation
  - read_path
  - fork_handling
  - pending_pool
  - testing_rules
  - code_quality
  - workflow
  - dont_miss
  - usage_guidelines
status: complete
rule_count: 80+
optimized_for_llm: true
existing_patterns_found: 16
source_documents:
  - 'ARCH: Синхронизация узла с блокчейном v1 (c3-arch-sinkhronizatsiya-uzla-s-blokcheynom-v1.md)'
  - 'ARCH: Интеграция контроллера с parser2 v1 (4f-arch-integratsiya-kontrollera-s-parser2-v1.md)'
  - 'Brief платформы (74-produktovyy-brif-platformy-tsifrovogo-kooperativa.md)'
target_repo: /home/admin/mono-ai-5/components/controller
---

# Project Context for AI Agents

_Критичные правила и паттерны для AI-агентов при работе с sync-кодом в `controller/`. Фокус — unobvious, часто забываемые детали. НЕ дублирует арх-документы, а выжимает enforcement._

Перед написанием кода — обязательно прочитать **`ARCH: Синхронизация узла с блокчейном v1`** и **`ARCH: Интеграция контроллера с parser2 v1`** (в `components/14-versiya-3/requirements/`).

---

## Technology Stack & Versions

- **TypeScript 5.x** (strict mode; `noImplicitAny`, `strictNullChecks`)
- **Node 20 LTS**
- **NestJS** (`@nestjs/common`, `@nestjs/core`, `@nestjs/event-emitter`)
- **TypeORM** + **PostgreSQL 14+**
- **Redis 7+** (AOF + RDB **mandatory** для prod — startup validation)
- **`@coopenomics/parser2` v1.0.0 MVP** (пост-миграция) + **`@coopenomics/coopos-ship-reader`** транзитивно
- **`@wharfkit/antelope`** — chain SDK для submit
- **EventEmitter2** — внутренняя шина (`delta::*`, `action::*`, `fork::*`)
- **Jest** — unit + e2e
- **pnpm 9+** + **Lerna** monorepo
- **reflect-metadata** — DI + декораторы (`@DomainKey`, `@SyncBehaviour`, `@Versioned`)
- **Feature flag** `USE_PARSER2_CLIENT` — поэтапный переход с legacy `BlockchainConsumerService` на `ParserClient`

---

## Critical Implementation Rules

### Language-Specific (TypeScript)

- **Bigint из PostgreSQL приходит как STRING.** Всегда `Number(blockNum) < Number(currentBlockNum)`, никогда не полагаться на `<`/`>` для `bigint`-колонок напрямую.
- **`Object.assign(this, blockchainData)` запрещено** в sync-сущностях — ломает типизацию. Только явное копирование полей.
- **Lowercase hash полей (`project_hash`, `listing_hash`)** — нормализация **в конструкторе/mapValue**, НЕ в mapper'ах и НЕ повторно в `updateFromBlockchain`.
- **Discriminated union для write-mutation response:** `{ status: 'applied' | 'pending' | 'failed' | 'conflict' }`. Клиент должен switch на статусе.
- **`Number(value.id)` + `String(value.coopname)`** — explicit typing при `mapValue`; не spread.
- **Imports из `~/shared/...`** (tsconfig paths) для kernel, не relative `../../../shared/`.

### Framework-Specific

**NestJS / DI:**
- Декораторы `@DomainKey({ primary, sync })` + `@SyncBehaviour({ forkPolicy, dlq })` + `@Versioned({ strategy })` — на sync-service классе. Metadata читается через `Reflect.getMetadata('sync:config', target)`.
- `@Inject(ENTITY_REPOSITORY)` token — symbol, определён в `domain/repositories/{entity}.repository.ts`.
- Dynamic modules через `{Contract}SyncModule.forEntity(Entity, TypeormEntity, Mapper)` — одна строка регистрации в `{contract}.module.ts`.

**TypeORM:**
- Миграции `migrations/{timestamp-ms}-{name}.ts`. `synchronize: true` **запрещено** в prod.
- `@Column({ type: 'bigint', nullable: true })` для `block_num`. Для `jsonb` — `@Column({ type: 'jsonb' })`.
- `ADD COLUMN NOT NULL` на больших таблицах — **двухэтапно**: ADD nullable → backfill → ALTER NOT NULL.
- Repository `extends BaseBlockchainRepository<DomainEntity, TypeormEntity>`. `findBySyncKey`, `createIfNotExists`, `deleteByBlockNumGreaterThan`, `restoreFromVersions` — **наследуются**, не реализовывать руками.

**parser2 integration:**
- `ParserClient` subscribe с `subscriptionId = "controller-${coopname}"`, `consumerName = "primary"` (детерминирован), `startFromBlock: 'last_known'`.
- Redis keys per-chain: `ce:parser2:<chain_id>:events`. НЕ писать в этот stream руками.
- `event_id` формат: `${chain}:{kind}:{block_num}:{block_id_short}:{natural_key}` — вычисляется parser2, consumer читает как есть.

**EventEmitter2:**
- `delta::{contract}::{table}` — внутренняя шина для syncer'ов.
- `{contract}{Entity}Updated` / `Deleted` / `RolledBack` / `PendingRetry` / `Failed` — **pubsub канал** для GraphQL subscriptions. Per-contract, не global.
- `entitysynced::{contract}::{table}` — для business-side-effect listeners (Matrix / Notification / и т.п.).

### Composite-Entity (ADR-008) — СТРОГО

- Namespaced: `entity.db.X` (DB-поля) / `entity.bc?.Y` (blockchain, nullable) / `entity.derived.Z` (computed getters).
- **НЕ** писать `entity.X` напрямую — ломает изоляцию.
- Конструктор `(databaseData, blockchainData?)` — обязан `throw` на sync-key mismatch.
- `updateFromBlockchain` возвращает **новый экземпляр** (immutable) или мутирует только `this.bc`, `this.block_num`, `this.present` — БЕЗ `Object.assign`.
- `derived` getter — детерминирован (NO `new Date()` в конструкторе / getter — ломает snapshot tests).
- Все signed-document поля нормализуются через `AbstractDeltaMapper.normalizeSignedDocuments` на основе `signedDocumentFields: SignedDocField[]` декларативно, НЕ руками в mapper.

### Dispatch pipeline (ADR-002, ADR-009) — СТРОГО

В `BlockchainParserAdapterService.dispatch`:

```
1. dedup check (event_id) → return если exists
2. save sync (через syncer)
3. dedup.mark
4. wake waiters (sync_key + block_num match)
5. emit internal bus (delta:: immediate / action:: delayed 3s)
6. emit pubsub {Entity}Updated (с entity из PG, не из raw delta)
```

- **Никогда** emit pubsub до save (INV-12).
- **Никогда** emit action immediate — только `setTimeout(emit, config.blockchain.actionEmitDelayMs)`.
- **Никогда** swallow ошибку в dispatch — re-throw либо DLQ.

### Write-mutation pattern (ADR-009, ADR-012) — СТРОГО

Application service:
```typescript
// 1. Pre-computed sync_key (deterministic)
const expectedHash = computeEntityHash(input);

// 2. Pre-gate: нет ли уже in-flight?
const inflight = await this.pool.findActive(contract, table, expectedHash);
if (inflight) return { status: 'conflict', existing_tx_hash: inflight.tx_hash, attempt: inflight.retry_count };

// 3. Submit через pool (placeholder → submit → finalize)
const tx = await this.pool.submitWithPool({ user_id, contract, table, sync_key: expectedHash, action_name }, input);

// 4. Wait-for-delta
const entity = await this.adapter.waitForDelta(contract, table, expectedHash, tx.applied_block, config.writeWaitDeltaMs);

// 5. Discriminated return
if (entity) return { entity, tx_hash: tx.tx_hash, status: 'applied' };
return { tx_hash: tx.tx_hash, status: 'pending' };
```

**Никогда**: `chainPort.submitTx(...)` напрямую в resolver/service — только `pool.submitWithPool`.
**Никогда**: `chainPort.getX(...)` в read-path — только `repository.findBySyncKey`.

### Read-path (ADR-011) — СТРОГО

- Queries / resolvers / application reads → **только Repository из Postgres**.
- `capitalBlockchainPort.getProject` / `getSegment` и аналоги — **retired из read-path**. Остаются только в:
  - Reconciliation cron (DEC-015).
  - OrphanPendingReconciler (17.6) — chain lookup для reconcile submitting-placeholder.
  - Admin / forensic CLI (не runtime).

Если repository вернул `null` — передать это наверх как pending state, НЕ fallback на RPC.

### Fork handling (ADR-005) — СТРОГО

- `@OnEvent('fork::*')` broadcast — **deprecated**. Использовать `ForkRegistry.register(handler)` в syncer onInit + вызов `forkRegistry.runAll(blockNum)` sequentially.
- Fork = ordered event в том же stream. Sequential XREADGROUP (single-active) = natural barrier.
- `ForkRegistry.runAll` — **последовательный for-await-of**, НЕ `Promise.all` (FK зависимости).
- После rollback entities → `dedupRepo.deleteAfterBlock` → `pool.handleFork` (retry) → emit `{Entity}RolledBack`.

### Pending Pool (ADR-012, раздел 17) — СТРОГО

- State machine: `submitting → pending → retrying → confirmed | abandoned`. Переходы — CAS `UPDATE ... WHERE status = 'expected'`.
- `placeholder pattern` для crash-window: INSERT `submitting` → submit → UPDATE `pending`. На boot — `OrphanPendingReconciler` сканит chain history по user_id для матча.
- Correlation: **sync_key primary** (deterministic) + **tx_hash fallback** (non-deterministic).
- **Кооператив подписывает tx, не пайщик.** Retry берёт текущий активный ключ кооператива из `chainPort`, user session не требуется.
- Retention: terminal states `confirmed`/`abandoned` живут `pendingTxRetentionHours` (default 24h).

### Testing Rules

**Обязательные сценарии для composite-entity:**
- Конструктор с `db`-only → entity валидна.
- Конструктор с `db + bc` → entity полная.
- `db.sync_key !== bc.sync_key` → `throw`.
- `update(bc, blockNum)` → новый экземпляр (immutable), старый не изменился.
- `derived` детерминирован (два вызова → одинаково).

**Обязательные сценарии для Adapter:**
- `dispatch` — порядок: dedup → save → mark → wake → emit bus → emit pubsub.
- `dispatch` duplicate event_id → no-op.
- `applyFork` — sequential через ForkRegistry.
- `waitForDelta` — resolves на match, null на timeout.

**Обязательные для Pool:**
- `submitWithPool` crash-window: crash между INSERT placeholder и submit → OrphanReconciler находит в chain history.
- `handleFork` при active retry — serialized.
- `retry` uses current cooperative key (после key rotation).
- `confirmByKey` guard: stale delta (block_num < applied) не confirm'ит.

**E2E (testcontainers + parser2 staging):**
- `fork-during-delta` — симулирует parser отправляющий delta+fork+delta в 100ms окне.
- `crash-between-submit-and-register` — прерывает процесс между chain submit и pool finalize.
- `pool-retry-on-fork` — pool auto-retry после fork.

**Mock ban:**
- **Не** mock'ать TypeORM в интеграционных тестах (testcontainers Postgres).
- **Не** mock'ать parser2 в e2e — использовать staging SHiP или dockerized parser2.

### Code Quality & Style

**Naming (жёстко):**
- Entity classes: `{Name}DomainEntity`, `{Name}TypeormEntity`.
- Interfaces: `I{Name}DomainInterfaceBlockchainData`, `I{Name}DomainInterfaceDatabaseData`.
- Mappers: `{Name}DeltaMapper`.
- Syncers: `{Name}SyncService`.
- Repositories: `{Name}Repository` (interface) + `{Name}TypeormRepository` (impl) + `{NAME}_REPOSITORY` (DI token).
- Files: kebab-case с суффиксом (`project.entity.ts`, `project.typeorm-entity.ts`, `project-delta.mapper.ts`, `project-sync.service.ts`).

**Paths (жёстко):**
- Per-contract: `extensions/{contract}/{domain|infrastructure|application}/...`.
- Kernel: `shared/sync/...`, `shared/decorators/...`, `shared/pubsub/...`, `shared/mappers/...`.
- Transport: `infrastructure/blockchain/`, `infrastructure/parser2/`, `infrastructure/redis/`.
- Cross-cutting domain: `domain/pending-tx/`, `domain/breach/`, `domain/reconciliation/`.

**Config (ENV-sourced, не hardcode):**
- `BLOCKCHAIN_ACTION_EMIT_DELAY_MS` default 3000
- `BLOCKCHAIN_WRITE_WAIT_DELTA_MS` default 3000
- `BLOCKCHAIN_ROLLBACK_HORIZON_BLOCKS` default 1000
- `BLOCKCHAIN_RECONCILE_CRON` default `'0 * * * *'`
- `BLOCKCHAIN_RECONCILE_SAMPLE_SIZE` default 100
- `BLOCKCHAIN_RECONCILE_TOLERANCE_BLOCKS` default 10
- `BLOCKCHAIN_FORK_PAUSE_TIMEOUT_MS` default 30000
- `BLOCKCHAIN_DLQ_MAX_RETRIES` default 5
- `BLOCKCHAIN_MAX_TX_RETRIES` default 3
- `BLOCKCHAIN_PENDING_TX_MAX_AGE_SECONDS` default 3600
- `BLOCKCHAIN_PENDING_TX_RETENTION_HOURS` default 24

Добавлять новый magic number? Сначала добавь в `config/blockchain.config.ts` + env var.

**Comments:**
- Нет комментариев к WHAT (код сам скажет). Только WHY + invariants + links на ADR в non-obvious местах.
- JSDoc для интерфейсов в `domain/interfaces/` — да. Для сервисов — нет (имена self-documenting).

### Development Workflow

- Branch naming: `feature/549-N-short-slug`, `fix/X-slug`, `arch/Y-slug`.
- Commit message: `[549-N][@ant] type: короткое описание` (существующая конвенция).
- PR — в обязательном порядке проходит **enforcement checklist** из секции 17 arch-документа.
- Migration review: автор migrate → ревью от второго инженера + проверка двухэтапности.
- Feature flag `USE_PARSER2_CLIENT` перед merge на main — рассматривается PR-mergability.

---

## Critical Don't-Miss Rules (Anti-Patterns)

### ❌ Silent data loss patterns

- `try { await syncer.process() } catch (e) { logger.error(e); return null; }` — **запрещено**. Re-throw или DLQ.
- `setTimeout(async () => { save + emit }, 3000)` — ACK раньше save, **silent loss при crash**. Pattern: save sync → ACK → `setTimeout(emit, 3000)`.
- `mapper.mapDeltaToBlockchainData(d) === null → warn → cursor вперёд` без алерта — pattern breaking. Всегда метрика + alert на unknown-version.

### ❌ Read-path anti-patterns

- `await capitalBlockchainPort.getProject(hash)` в resolver / application — **retire**. Только `repository.findBySyncKey`.
- RPC fallback "если PG не отдал" — **запрещено**. Если PG null → pending status наверх.

### ❌ Composite-entity anti-patterns

- `project.matrix_room_id` (flat access) — **запрещено**. Правильно: `project.db.matrix_room_id`.
- `project.master` (flat access) — **запрещено**. Правильно: `project.bc?.master`.
- `Object.assign(this, blockchainData)` в update — **запрещено**.
- Новый `new Date()` в конструкторе или derived-getter — **запрещено** (ломает snapshot-tests).

### ❌ Fork handling anti-patterns

- `Promise.all(registry.map(...))` для rollback — **запрещено** (FK зависимости). For-await-of sequential.
- `@OnEvent('fork::*')` в syncer без ForkRegistry — **deprecated**. Миграция обязательна.

### ❌ Write-mutation anti-patterns

- `chainPort.submitTx()` напрямую — **запрещено** (теряется pool tracking). Только через `pool.submitWithPool`.
- `hardcoded 3000` в setTimeout — **запрещено**. Только `config.blockchain.actionEmitDelayMs` / `writeWaitDeltaMs`.
- Pre-gate отсутствует (два click'а пайщика создают duplicate submit) — **запрещено**. Всегда `pool.findActive` перед submit.

### ❌ Idempotency anti-patterns

- Skip event_id dedup "потому что там block_num guard есть" — **запрещено**. Dedup FIRST в pipeline.
- Использовать raw `block_num` вместо `event_id` для dedup — пропускает branch fork scenarios.

### ❌ Subscription anti-patterns

- Emit pubsub **до** save в PG — **запрещено** (INV-12). Клиент получит "updated" event на несохранённое состояние.
- Global channel `entityUpdated(contract, ...)` — **запрещено**. Per-contract isolation обязателен.
- Emit raw delta в subscription payload — **запрещено**. Payload = domain entity, read из PG.

### ⚠️ Edge cases — обязательно handle

- `block_num = null` — сущность создана до sync. НЕ rollback'ится форком. После breach `force_restore: ignore_local_edits` flag.
- `present = false` → `blockchainData = undefined` (INV-02). Domain читает как валидное (удалённое в блокчейне).
- `parent_hash === '0000...0000'` — sentinel для "нет parent". Константа `ZERO_HASH` в shared, НЕ magic string.
- `mapStatusToDomain` unknown status → `UNDEFINED` fallback **плюс** alert (schema drift).

### 🔐 Security

- Кооперативный ключ — в `config.cooperative.signingKey`, НЕ в коде. Startup validation.
- User ID в `pending_tx` — только для notifications, НЕ для signing.
- Subscription authorization — per-cooperative scope обязателен (OQ-T15).
- Breach freeze — админ endpoint **только** через multi-sig (TODO: Phase 2).

### ⚡ Performance

- `JSON.stringify` на сущностях с nested signed-documents — использовать `json-stable-stringify` для canonical checksum.
- Reconciliation cron — sample N=100 rows, **не** full scan на hot path.
- IPFS fetch для signed-doc — **lazy resolver вне consumer critical path**, не в mapper.
- `waitForDelta` memory leak — timer cleanup обязателен (см. INV-T10).

---

## Usage Guidelines

**Для AI-агентов:**
- Прочитать этот файл **перед** написанием любого sync-кода в `controller/`.
- Следовать ВСЕМ правилам дословно.
- При сомнении — выбирать более строгий вариант (не fallback на RPC, не swallow ошибку, не flat access).
- Обновлять этот файл если возникает новый паттерн который AI-агенты могут пропустить.

**Для людей:**
- Держать файл LEAN и ориентированным на агентов.
- Обновлять при изменении стека / ADR.
- Периодически (раз в квартал) вычищать очевидные правила.
- **Не** добавлять описание "что делает код" — только "что легко сломать".

**Источники истины (при противоречии):**
1. ADR в `ARCH: Синхронизация узла с блокчейном v1` — главный источник архитектурных решений.
2. `ARCH: Интеграция контроллера с parser2 v1` — транспортный слой.
3. Этот файл — enforcement выжимка, не overrides ADR.

Last Updated: 2026-04-24
