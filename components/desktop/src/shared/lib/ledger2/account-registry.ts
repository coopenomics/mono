/**
 * Re-export плана счетов ledger2 из `cooptypes`. Источник правды —
 * `components/cooptypes/src/ledger2/accounts.ts`, синхронно с C++-стороной
 * (`components/contracts/cpp/lib/core/ledger2/accounts.hpp`).
 *
 * Обёртка сохранена только ради стабильного пути `src/shared/lib/ledger2`
 * для уже существующих потребителей (AccountIdCell и пр.). При добавлении
 * счёта править cooptypes + contract, не здесь.
 */
import { Ledger2 } from 'cooptypes'

export type AccountKind = Ledger2.AccountKind
export type AccountMeta = Ledger2.AccountMeta

export const LEDGER2_ACCOUNT_REGISTRY = Ledger2.LEDGER2_ACCOUNT_REGISTRY
export const getAccountName = Ledger2.getAccountName
export const getAccountMeta = Ledger2.getAccountMeta
export const storedIdToCode = Ledger2.storedIdToCode
