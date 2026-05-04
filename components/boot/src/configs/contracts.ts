/* eslint-disable node/prefer-global/process */
import path from 'node:path'
import { config } from 'dotenv'

config()

/**
 * Резолвер пути до wasm/abi пары контракта.
 *
 * Layout:
 * - **CONTRACTS_DIR не задан** (локальная сборка через `components/contracts/build*.sh`)
 *   — `eosio.*` лежат в `system/contracts/<name>/`, остальные в `<name>/`.
 * - **CONTRACTS_DIR задан** (образ `dicoop/contracts`, mounted в bootstrap-контейнере)
 *   — flat layout: все контракты в `<CONTRACTS_DIR>/<name>/<name>.{wasm,abi}`,
 *   включая `eosio.*` (см. `.github/workflows/build-contracts.yaml` — system-контракты
 *   распакованы из `system/contracts/eosio.*` в плоский корень при упаковке).
 *
 * Это позволяет одному и тому же `boot:remote` работать и из локального workspace,
 * и из bootstrap-образа, без дублирования конфигов.
 */
const CONTRACTS_DIR = process.env.CONTRACTS_DIR
const userBase = CONTRACTS_DIR ?? path.resolve(process.cwd(), '../contracts/build/contracts')
const systemBase = CONTRACTS_DIR ?? path.resolve(process.cwd(), '../contracts/build/contracts/system/contracts')

export default [
  {
    name: 'eosio.boot',
    path: path.join(systemBase, 'eosio.boot'),
    target: 'eosio',
  },
  {
    name: 'eosio.system',
    path: path.join(systemBase, 'eosio.system'),
    target: 'eosio',
  },
  {
    name: 'eosio.token',
    path: path.join(systemBase, 'eosio.token'),
    target: 'eosio.token',
  },
  {
    name: 'eosio.msig',
    path: path.join(systemBase, 'eosio.msig'),
    target: 'eosio.msig',
  },
  {
    name: 'eosio.wrap',
    path: path.join(systemBase, 'eosio.wrap'),
    target: 'eosio.wrap',
  },
  {
    name: 'registrator',
    path: path.join(userBase, 'registrator'),
    target: 'registrator',
  },
  {
    name: 'soviet',
    path: path.join(userBase, 'soviet'),
    target: 'soviet',
  },
  {
    name: 'marketplace',
    path: path.join(userBase, 'marketplace'),
    target: 'marketplace',
  },
  {
    name: 'draft',
    path: path.join(userBase, 'draft'),
    target: 'draft',
  },
  {
    name: 'branch',
    path: path.join(userBase, 'branch'),
    target: 'branch',
  },
  {
    name: 'gateway',
    path: path.join(userBase, 'gateway'),
    target: 'gateway',
  },
  {
    name: 'fund',
    path: path.join(userBase, 'fund'),
    target: 'fund',
  },
  {
    name: 'ledger',
    path: path.join(userBase, 'ledger'),
    target: 'ledger',
  },
  {
    name: 'ledger2',
    path: path.join(userBase, 'ledger2'),
    target: 'ledger2',
  },
  {
    name: 'test',
    path: path.join(userBase, 'test'),
    target: 'test',
  },
  {
    name: 'contributor',
    path: path.join(userBase, 'contributor'),
    target: 'contributor',
  },
  {
    name: 'capital',
    path: path.join(userBase, 'capital'),
    target: 'capital',
  },
  {
    name: 'wallet',
    path: path.join(userBase, 'wallet'),
    target: 'wallet',
  },
  {
    name: 'loan',
    path: path.join(userBase, 'loan'),
    target: 'loan',
  },
  {
    name: 'meet',
    path: path.join(userBase, 'meet'),
    target: 'meet',
  },
  {
    name: 'apps',
    path: path.join(userBase, 'apps'),
    target: 'apps',
  },
]
