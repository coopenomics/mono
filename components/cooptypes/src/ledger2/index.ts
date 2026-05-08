/**
 * ledger2 — реестры счетов и кошельков, зеркало source-of-truth из
 * смарт-контрактов (`cpp/lib/core/ledger2/`). Используется потребителями
 * (standards-site, desktop/shared/lib/ledger2) как единый справочник имён
 * для UI-подсказок.
 */

export * from './accounts'
export * from './wallets'
export * from './processes'
export * from './operations'
export * from './programs'
