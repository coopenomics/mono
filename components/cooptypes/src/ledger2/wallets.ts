/**
 * Реестр кошельков ledger2 — source of truth в контракте:
 * `components/contracts/cpp/lib/core/ledger2/wallets.hpp`
 * (`LEDGER2_WALLET_REGISTRY`, `LEDGER2_USER_SHARED_PROGRAM_MAPPING`).
 *
 * Сами реестры лежат в `wallets.generated.ts` и регенерируются скриптом
 * `pnpm --filter cooptypes gen:from-cpp` (он же висит на prebuild). Этот
 * файл оборачивает generated и добавляет runtime-helpers для UI/контроллера.
 *
 * Идентификатор кошелька — `eosio::name` с префиксом `w.<contract>.<waltype>`
 * (по аналогии с операциями `o.<contract>.<verb>` и процессами
 * `p.<contract>.<noun>`). Длина ≤ 13 base32-символов.
 *
 * Классификация `WalletKind` (ADR-002):
 *   USER_SHARED  — обязателен L3-разрез по пайщику (`ledger2::userwallets`).
 *   COOPERATIVE  — единый кооперативный баланс, без L3.
 */
import type { IName } from '../interfaces/ledger2'

export {
  LEDGER2_USER_SHARED_PROGRAM_MAPPING,
  LEDGER2_WALLET_REGISTRY,
} from './wallets.generated'
export type {
  ProgramWalletMapping,
  WalletKind,
  WalletMeta,
} from './wallets.generated'

import {
  LEDGER2_USER_SHARED_PROGRAM_MAPPING,
  LEDGER2_WALLET_REGISTRY,
} from './wallets.generated'
import type { WalletKind } from './wallets.generated'

const walletHumanByName = new Map<string, string>(
  LEDGER2_WALLET_REGISTRY.map(w => [w.name, w.human_name]),
)

const walletKindByName = new Map<string, WalletKind>(
  LEDGER2_WALLET_REGISTRY.map(w => [w.name, w.kind]),
)

const programIdByWalletName = new Map<string, number>(
  LEDGER2_USER_SHARED_PROGRAM_MAPPING
    .filter(m => m.required_program_id > 0)
    .map(m => [m.wallet_name, m.required_program_id]),
)

const walletNamesByProgramId = (() => {
  const acc = new Map<number, string[]>()
  for (const m of LEDGER2_USER_SHARED_PROGRAM_MAPPING) {
    if (m.required_program_id <= 0) continue
    const list = acc.get(m.required_program_id) ?? []
    list.push(m.wallet_name)
    acc.set(m.required_program_id, list)
  }
  return acc
})()

/**
 * wallet_name, в который пишется membership_contribution для program_id=1 (ЦК).
 * При миграции `progwallets → userwallets` ЦК расщепляется на пай + членский.
 */
export const MEMBERSHIP_WALLET_NAME = 'w.wal.member'

/**
 * Все wallet_name'ы, привязанные к какой-либо программе (program_id > 0).
 * Исключает кошельки с required_program_id == 0 (например, `w.reg.minshr`).
 */
export const ALL_PROGRAM_WALLET_NAMES: readonly string[] = LEDGER2_USER_SHARED_PROGRAM_MAPPING
  .filter(m => m.required_program_id > 0)
  .map(m => m.wallet_name)

/**
 * Человекочитаемое имя кошелька по его eosio::name-идентификатору.
 * Возвращает undefined для незарегистрированных имён и для пустого имени
 * (sentinel "" — кошелёк-источник/сток вне системы при ISSUE/BURN).
 */
export function getWalletHumanName(name: IName | null | undefined): string | undefined {
  if (!name) return undefined
  return walletHumanByName.get(name)
}

/**
 * `WalletKind` кошелька по его eosio::name (ADR-002, ADR-010).
 * Возвращает undefined для незарегистрированных имён.
 */
export function getWalletKind(name: IName | null | undefined): WalletKind | undefined {
  if (!name) return undefined
  return walletKindByName.get(name)
}

/**
 * wallet_name'ы, входящие в данный program_id. Пустой массив для отсутствующих
 * или для program_id == 0 (исключения вроде `w.reg.minshr`).
 */
export function walletNamesForProgram(program_id: number | string | undefined | null): string[] {
  if (program_id === undefined || program_id === null) return []
  return walletNamesByProgramId.get(Number(program_id)) ?? []
}

/**
 * program_id для wallet_name (или undefined, если кошелёк не USER_SHARED
 * либо в исключениях с program_id == 0).
 */
export function programIdForWallet(wallet_name: IName | null | undefined): number | undefined {
  if (!wallet_name) return undefined
  return programIdByWalletName.get(wallet_name)
}
