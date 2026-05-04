# `dicoop/contracts` — образ-артефакт всех контрактов

Контейнер собирает в один slim alpine-образ wasm/abi всех контрактов
кооперативной экономики (`apps, marketplace, ledger, meet, loan, wallet,
capital, branch, contributor, fund, draft, soviet, registrator, gateway,
system, test`).

## Зачем отдельный образ

- Нода (`dicoop/blockchain_v5.1.1`) — это runtime с `nodeos`. Она
  одна и не должна повторно собираться вместе с контрактами.
- Сборка контрактов (через CDT) — отдельный шаг CI, выполняется в том
  же `dicoop/blockchain_v5.1.1`-образе но в режиме toolchain.
- Деплой — третий артефакт (`ke-bootstrap`), который читает контракты
  отсюда и применяет их к ноде через `cleos set contract`.

Эта декомпозиция даёт переиспользование: одна нода + N версий контрактов
+ один bootstrap.

## Layout внутри образа

```
/contracts/
├── apps/
│   ├── apps.wasm
│   └── apps.abi
├── marketplace/
│   ├── marketplace.wasm
│   └── marketplace.abi
├── ...
└── manifest.json    # имена + sha256 + build_mode + git sha + timestamp
```

## Тэги

| Ветка | Tag | `IS_TESTNET` |
| --- | --- | --- |
| `dev` | `dicoop/contracts:dev` | ON |
| `testnet` | `dicoop/contracts:testnet` | ON |
| `main` | `dicoop/contracts:main` + `:latest` | OFF |

Дополнительно для воспроизводимости каждый push публикуется как
`dicoop/contracts:<tag>-<short_sha>`.

## Использование

### 1. Multi-stage в bootstrap-образе (production)

```dockerfile
FROM dicoop/contracts:testnet AS contracts

FROM dicoop/blockchain_v5.1.1:dev
COPY --from=contracts /contracts /work/contracts
# ... bootstrap-script использует /work/contracts при cleos set contract
```

### 2. Volume-mount (debug, локальные dev-окружения)

```bash
mkdir -p ./out
docker run --rm -v "$PWD/out:/out" dicoop/contracts:testnet
ls out/
# apps/ marketplace/ ledger/ ... manifest.json
```

### 3. Точечно один контракт

```bash
docker run --rm -v "$PWD/out:/out" dicoop/contracts:testnet copy apps
ls out/apps/
# apps.wasm apps.abi
```

### 4. Аудит / диагностика

```bash
# Список всех контрактов в образе:
docker run --rm dicoop/contracts:testnet list

# Контрольные суммы:
docker run --rm dicoop/contracts:testnet sha256

# Манифест с метаданными сборки:
docker run --rm dicoop/contracts:testnet manifest | jq .
```

## Локальная сборка

```bash
# 1. Скомпилировать контракты:
cd components/contracts
./build-all.sh prod    # или ./build-all.sh test для testnet-режима

# 2. Подготовить docker context:
mkdir -p docker/.context/contracts
for c in apps marketplace ledger meet loan wallet capital branch \
         contributor fund draft soviet registrator gateway system test; do
  if [ -f build/contracts/$c/$c.wasm ]; then
    mkdir -p docker/.context/contracts/$c
    cp build/contracts/$c/$c.wasm docker/.context/contracts/$c/
    cp build/contracts/$c/$c.abi  docker/.context/contracts/$c/
  fi
done
cp docker/Dockerfile docker/entrypoint.sh docker/.context/

# 3. Build:
docker build -t dicoop/contracts:local ./docker/.context
```

В CI этот pipeline автоматизирован — см.
`.github/workflows/build-contracts.yaml`.
