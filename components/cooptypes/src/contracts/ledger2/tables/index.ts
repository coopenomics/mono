// Таблицы контракта ledger2 — каждая со своим tableName и scope, в едином
// формате с остальными контрактами (см. capital/tables/*). Реальный контент
// строк живёт в blockchain_deltas (Postgres), контракт пишет их через
// actions `debit` / `credit` / `walletop`.

export * as Accounts from './accounts'
export * as Wallets from './wallets'
export * as Meta from './meta'
