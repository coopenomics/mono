/**
 * Деньги пайщика на стенде. Пополнение — подготовка состояния: паевой
 * кошелёк наполняется прямо в цепи (приход по шлюзу от имени кооператива,
 * как это делает платёжный провайдер), проверяемое читается через API.
 */
import crypto from 'node:crypto'
import type { Who } from './auth'
import { tableRows, transact } from './chain'
import { gql } from './client'
import { COOP, DEFAULT_WIF } from './env'
import { waitFor } from './wait'

/** Кооператив как подписант: у стенда его ключ — общий ключ boot. */
export const COOP_SIGNER: Who = { account: COOP, email: '', wif: DEFAULT_WIF }

/** «100.0000 RUB» → 100. */
export function amount(q: unknown): number {
  return Number.parseFloat(String(q ?? '0').split(' ')[0])
}

export function rub(n: number): string {
  return `${n.toFixed(4)} RUB`
}

/** Доступный остаток главного паевого кошелька (ledger2, цепь). */
export async function availableShare(username: string): Promise<number> {
  const rows = await tableRows<any>('ledger2', COOP, 'userwallets')
  const row = rows.find(r => r.username === username && r.wallet_name === 'w.wal.share')
  return amount(row?.available)
}

/**
 * Паевой взнос деньгами: заявка на приход (wallet::createdpst) и его
 * исполнение шлюзом (gateway::incomplete) — имена из cooptypes.
 */
export async function deposit(username: string, sum: number): Promise<void> {
  const hash = crypto.randomBytes(32).toString('hex')
  await transact(COOP_SIGNER, [{
    account: 'wallet',
    name: 'createdpst',
    data: { coopname: COOP, username, deposit_hash: hash, quantity: rub(sum) },
  }])
  await transact(COOP_SIGNER, [{
    account: 'gateway',
    name: 'incomplete',
    data: { coopname: COOP, income_hash: hash },
  }])
}

/**
 * Довести паевой остаток до минимума. С токеном пайщика — ждать, пока
 * зеркало контроллера увидит деньги: оформление заказа проверяет остаток по
 * зеркалу, а пополнение шло мимо контроллера.
 */
export async function ensureShareFunds(username: string, minimumRub: number, memberToken?: string): Promise<number> {
  const have = await availableShare(username)
  if (have < minimumRub)
    await deposit(username, Math.ceil(minimumRub - have) + 10_000)
  if (memberToken) {
    await waitFor(async () => {
      const d = await gql<any>(memberToken, 'query{ marketplaceMemberWallet{ wallets{ name available } } }')
      const row = d.marketplaceMemberWallet.wallets.find((w: any) => w.name === 'w.wal.share')
      return row && amount(row.available) >= minimumRub ? true : null
    }, { timeoutMs: 120_000, intervalMs: 2_000, label: `зеркало кошелька ${username} ≥ ${minimumRub} RUB` })
  }
  return availableShare(username)
}
