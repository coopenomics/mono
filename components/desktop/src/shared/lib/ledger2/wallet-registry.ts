/**
 * Re-export реестра кошельков ledger2 из `cooptypes`. Источник правды —
 * `components/cooptypes/src/ledger2/wallets.ts`, синхронно с C++-стороной
 * (`components/contracts/cpp/lib/core/ledger2/wallets.hpp`).
 *
 * Обёртка сохранена только ради стабильного пути `src/shared/lib/ledger2`
 * для уже существующих потребителей (WalletIdCell и пр.). При добавлении
 * кошелька править cooptypes + contract, не здесь.
 */
import { Ledger2 } from 'cooptypes'

export type WalletMeta = Ledger2.WalletMeta

export const LEDGER2_WALLET_REGISTRY = Ledger2.LEDGER2_WALLET_REGISTRY
export const getWalletHumanName = Ledger2.getWalletHumanName
