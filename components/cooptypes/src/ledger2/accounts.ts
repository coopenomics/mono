/**
 * Реестр плана счетов ledger2 — source of truth в контракте:
 * `components/contracts/cpp/lib/core/ledger2/accounts.hpp`
 * (`LEDGER2_ACCOUNT_MAP`). В контракте id хранится как `code * 1000`
 * (51 → 51000), здесь — человеческий код счёта (51).
 *
 * При добавлении нового счёта синхронизировать contract-side.
 */
export type AccountKind = 'active' | 'passive' | 'active_passive'

export interface AccountMeta {
  code: number
  name: string
  kind: AccountKind
}

export const LEDGER2_ACCOUNT_REGISTRY: readonly AccountMeta[] = [
  { code: 4,  name: 'Нематериальные активы',            kind: 'active' },
  { code: 8,  name: 'Вложения во внеоборотные активы',  kind: 'active' },
  { code: 51, name: 'Расчётный счёт',                   kind: 'active' },
  { code: 58, name: 'Финансовые вложения',              kind: 'active' },
  { code: 80, name: 'Паевой фонд (складочный капитал)', kind: 'passive' },
  { code: 86, name: 'Целевое финансирование',           kind: 'passive' },
] as const

const accountByCode = new Map<number, AccountMeta>(
  LEDGER2_ACCOUNT_REGISTRY.map((a) => [a.code, a]),
)

export function getAccountName(code: number | null | undefined): string | undefined {
  if (code == null) return undefined
  return accountByCode.get(code)?.name
}

export function getAccountMeta(code: number | null | undefined): AccountMeta | undefined {
  if (code == null) return undefined
  return accountByCode.get(code)
}

/** Преобразует stored id (51000) в человеческий code (51). */
export function storedIdToCode(storedId: number | null | undefined): number | null {
  if (storedId == null) return null
  return Math.round(storedId / 1000)
}
