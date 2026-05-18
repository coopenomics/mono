/**
 * Helper для Story 11.2: проверка журналирования marketplace-операций в
 * on-chain `blockchain_actions` через `getLedger2History`.
 *
 * Каждая marketplace-операция через `ledger2::apply` должна писать запись с
 * `process_hash`, `operation_code`, `actor_account`, `target_accounts`, `at`,
 * `tx_id` и связанные `walletop` / `debit` / `credit` sibling-actions.
 *
 * Source of truth — `getLedger2History(processHash, parentApplyGlobalSequence?)`
 * в controller. Off-chain.
 */

import { gql } from '../shared/apiClient'
import { Ledger2 } from 'cooptypes'

const HISTORY_QUERY = `query($i:GetLedger2HistoryInput!){
  getLedger2History(input:$i){
    items {
      action operationCode processHash accountId quantity walletFrom walletTo
      globalSequence createdAt username
    }
    totalCount totalPages currentPage
  }
}`

interface Ledger2HistoryItem {
  action: string
  operationCode: string | null
  processHash: string | null
  accountId: number | null
  quantity: string | null
  walletFrom: string | null
  walletTo: string | null
  globalSequence: string
  createdAt: string
  username: string | null
}

export interface ProcessTrace {
  process_hash: string
  applies: Ledger2HistoryItem[]
  walletops: Ledger2HistoryItem[]
  debits: Ledger2HistoryItem[]
  credits: Ledger2HistoryItem[]
  /** Operation codes которые встретились в trace (по apply.operationCode). */
  operation_codes: string[]
}

export async function loadProcessTrace(
  token: string,
  coopname: string,
  process_hash: string,
): Promise<ProcessTrace> {
  const data = await gql<{ getLedger2History: { items: Ledger2HistoryItem[] } }>(
    token,
    HISTORY_QUERY,
    {
      i: {
        coopname,
        processHash: process_hash,
        actionNames: ['apply', 'walletop', 'debit', 'credit'],
        limit: 500,
        page: 1,
        sortOrder: 'ASC',
      },
    },
  )
  const items = data.getLedger2History.items
  return {
    process_hash,
    applies: items.filter((i) => i.action === 'apply'),
    walletops: items.filter((i) => i.action === 'walletop'),
    debits: items.filter((i) => i.action === 'debit'),
    credits: items.filter((i) => i.action === 'credit'),
    operation_codes: items
      .filter((i) => i.action === 'apply')
      .map((i) => i.operationCode ?? '')
      .filter(Boolean),
  }
}

/**
 * Проверяет, что для конкретной marketplace-операции реестр содержит
 * полный набор sibling-actions по правилам ledger2.
 *
 * - Любой operation_code → должен быть apply с этим operationCode и
 *   соответствующим actor_account / process_hash.
 * - Для WalletOp ≠ NONE → должен быть один walletop с before/after на
 *   wallet_from / wallet_to (sanity: action='walletop' с тем же
 *   process_hash).
 * - Если op имеет Dr/Cr ≠ 0 → должны быть debit + credit на нужных
 *   account_id.
 */
export function assertOperationTraced(trace: ProcessTrace, operation_code: string): void {
  const meta = Ledger2.getOperationMeta(operation_code)
  if (!meta) {
    throw new Error(`Operation ${operation_code} не найден в LEDGER2_OPERATION_REGISTRY`)
  }
  const apply = trace.applies.find((a) => a.operationCode === operation_code)
  if (!apply) {
    throw new Error(`apply для ${operation_code} не найден в trace ${trace.process_hash}`)
  }
  if (!apply.processHash || apply.processHash !== trace.process_hash) {
    throw new Error(`apply.processHash != trace.process_hash для ${operation_code}`)
  }

  const expectsWalletop =
    meta.wallet_op !== null && meta.wallet_op !== 'NONE'
  if (expectsWalletop) {
    const wop = trace.walletops.find(
      (w) =>
        (meta.wallet_from && w.walletFrom === meta.wallet_from) ||
        (meta.wallet_to && w.walletTo === meta.wallet_to),
    )
    if (!wop) {
      throw new Error(
        `walletop для ${operation_code} (op=${meta.wallet_op}, from=${meta.wallet_from}, to=${meta.wallet_to}) не найден`,
      )
    }
  }

  const expectsPosting = meta.debit !== null && meta.credit !== null
  if (expectsPosting) {
    const debit = trace.debits.find((d) => d.accountId != null && Math.round(d.accountId / 1000) === meta.debit)
    const credit = trace.credits.find((c) => c.accountId != null && Math.round(c.accountId / 1000) === meta.credit)
    if (!debit) {
      throw new Error(`debit на счёт ${meta.debit} для ${operation_code} не найден`)
    }
    if (!credit) {
      throw new Error(`credit на счёт ${meta.credit} для ${operation_code} не найден`)
    }
  }
}

/**
 * Все 13 marketplace operation_codes из cooptypes ledger2 — для проверки
 * полноты регистра тестового сценария.
 */
export const MARKETPLACE_OPERATION_CODES: readonly string[] = [
  'o.wal.conv',
  'o.mkt.assign',
  'o.mkt.block',
  'o.mkt.unblk',
  'o.mkt.recall',
  'o.mkt.purch',
  'o.mkt.payout',
  'o.mkt.consum',
  'o.mkt.consum2',
  'o.mkt.return',
  'o.mkt.return2',
  'o.mkt.wroff',
  'o.mkt.wroff2',
] as const

/**
 * Проверяет, что operation_code из LEDGER2_OPERATION_REGISTRY содержит
 * запись для каждого из 13 marketplace кодов — иначе cooptypes/contract
 * рассинхронизированы.
 */
export function assertMarketplaceOperationsRegistered(): void {
  for (const code of MARKETPLACE_OPERATION_CODES) {
    const meta = Ledger2.getOperationMeta(code)
    if (!meta) {
      throw new Error(`Operation ${code} не зарегистрирован в LEDGER2_OPERATION_REGISTRY`)
    }
  }
}
