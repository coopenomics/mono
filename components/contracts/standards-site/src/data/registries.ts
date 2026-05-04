/**
 * Реестры ledger2 для standards-site — re-export из общего пакета
 * `cooptypes` (модуль `Ledger2`).
 *
 * Source of truth — в `components/cooptypes/src/ledger2/`; здесь только
 * тонкие обёртки под прежний API, чтобы не переписывать потребителей.
 */

import { Ledger2 } from 'cooptypes'

export const LEDGER2_ACCOUNT_REGISTRY = Ledger2.LEDGER2_ACCOUNT_REGISTRY
export const LEDGER2_WALLET_REGISTRY = Ledger2.LEDGER2_WALLET_REGISTRY

export function getAccount(code: number | null | undefined) {
  return Ledger2.getAccountMeta(code)
}

export function getWallet(name: string | null | undefined) {
  if (name == null || name === '') return undefined
  return Ledger2.LEDGER2_WALLET_REGISTRY.find((w) => w.name === name)
}
