# Контракт `apps` — каталог приложений

Координационная плоскость платформы Каталога приложений ВОСХОД
(`apps-catalog`). Деплоится на корневой KE-цепи и обслуживает несколько
подсетей кооперативов одновременно.

## Что хранит

| Таблица    | PK                | Назначение                                                  |
| ---------- | ----------------- | ----------------------------------------------------------- |
| `packages` | `package_id`      | Реестр зарегистрированных пакетов (Antelope `name`)         |
| `releases` | auto-inc          | Текущие active + недавние superseded релизы (TTL 90 дней)   |
| `subs`     | auto-inc          | Подписки `(coopname × package_id × chain_id)` на пакеты     |
| `coops`    | `coopname`        | Кооперативы каталога: chain_id подсети + subnet-signing-key |

## Жизненный цикл релиза

```
   regpackage(pkg, owner, subnets)
        │
        ▼
   ┌─────────┐  setrelease(scope=all)         ┌────────────┐
   │ packages│ ─────────────────────────────► │ releases   │
   │   pkg   │  (creates active, supersedes   │  active    │
   └─────────┘   prior active с тем же scope) └────────────┘
                                                    │
                                  setrelease(новая) │
                                                    ▼
                                              ┌────────────┐
                                              │ superseded │  TTL 90d
                                              │ + auto-rm  │  inline cleanup
                                              └────────────┘
                                                    │
                                                    │  reactivate(version=старая)
                                                    ▼
                                              ┌────────────┐
                                              │  active    │
                                              └────────────┘

   withdraw(version)         ┌────────────┐
   ─────────────────────────►│ withdrawn  │  не подпадает под TTL
                              └────────────┘
```

## Authorization (MVP)

- Все mutating actions: `<coopname>@active`.
- `cleanup` — без auth (доброкачественная операция).
- `migrate` — `apps@active`.

## Authorization (план)

- `regsub`/`expsub` → выделенный `<coopname>@billing`-permission, когда
  биллинг отделится от провайдера каталога.
- `regcoop`/`setcoop` → `<coopname>@subnet`-permission, когда onboarding
  кооперативов формализуется отдельным процессом.

Миграция через `eosio.msig`-предложение.

## Локальная сборка

```bash
# из components/contracts/
./build.sh apps prod   # production
./build.sh apps test   # с #define IS_TESTNET=1
```

Артефакт — `build/contracts/apps/apps.{wasm,abi}`. Упаковка артефактов
всех контрактов в docker-образ — см. `components/contracts/docker/`.

## Якоря

- `apps-catalog` epics.md Story 6.x — KE bootstrap.
- `apps-catalog` docs/architecture.md §"KE blockchain (контракт apps)".
- Memory `project_subnet_identification` — chain_id как идентификатор подсети.
