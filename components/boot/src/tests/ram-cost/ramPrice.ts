/**
 * Цена оперативной памяти цепи в AXON — замер, а не расчёт по формуле.
 *
 * Память кооператив арендует действием `eosio::powerup`: платёж делится на
 * NET (25 %), CPU (25 %) и RAM (50 %), RAM-часть превращается в байты по
 * линейному рынку и сначала гасит долг по памяти (`eosio::ramdebts`). Аренда
 * живёт `powerup_days` суток (`eosio::powerstate`), потом её продлевают.
 *
 * Замер: кооператив платит за аренду себе ровно 1 AXON, и прирост его квоты
 * памяти (`ram_quota`) — это байты, которые даёт 1 AXON на срок аренды. Цена
 * байт·суток = 1 AXON / (байты × сутки аренды).
 */
import { SystemContract } from 'cooptypes'
import type Blockchain from '../../blockchain'
import config from '../../configs'
import { CHAIN_URL } from '../marketplace/chainHelpers'

export interface RamPrice {
  /** Сколько заплачено за аренду, AXON. */
  payment_axon: number
  /** Прирост квоты памяти от платежа, байт. */
  bytes_per_payment: number
  /** Срок аренды, сутки. */
  powerup_days: number
  /** Цена одного байта на сутки, AXON. */
  axon_per_byte_day: number
  /** Ожидание по формуле контракта: половина платежа в минимальных единицах токена = байты. */
  expected_bytes_by_formula: number
  /** Долг кооператива по памяти до аренды, байт (гасится из RAM-части платежа). */
  ram_debt_before: number
}

async function chainPost<T = any>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${CHAIN_URL}/v1/chain/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok)
    throw new Error(`${endpoint}: HTTP ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

async function ramQuota(account: string): Promise<number> {
  return Number((await chainPost('get_account', { account_name: account })).ram_quota)
}

async function ramDebt(account: string): Promise<number> {
  const d: any = await chainPost('get_table_rows', { json: true, code: 'eosio', scope: 'eosio', table: 'ramdebts', lower_bound: account, upper_bound: account, limit: 1 })
  return Number(d.rows?.[0]?.ram_debt ?? 0)
}

async function balance(account: string, symbol: string): Promise<number> {
  const d: string[] = await chainPost('get_currency_balance', { code: 'eosio.token', account, symbol })
  return Number.parseFloat(d[0] ?? '0')
}

/** Аренда на 1 AXON кооперативу и пересчёт в цену байт·суток. */
export async function measureRamPrice(bc: Blockchain, coop: string): Promise<RamPrice> {
  const symbol = config.token.symbol
  const precision = config.token.precision
  const payment = 1
  const state: any = (await chainPost('get_table_rows', { json: true, code: 'eosio', scope: '', table: 'powerstate', limit: 1 })).rows[0]
  const days = Number(state.powerup_days)

  // Аренду платит сам кооператив — так, как он будет платить в работе.
  if (await balance(coop, symbol) < payment)
    await bc.transfer({ from: 'eosio', to: coop, quantity: `${payment.toFixed(precision)} ${symbol}`, memo: 'ram-cost: аренда для замера цены памяти' })

  const debt = await ramDebt(coop)
  const before = await ramQuota(coop)
  await bc.api.transact({
    actions: [{
      account: SystemContract.contractName.production,
      name: SystemContract.Actions.Powerup.actionName,
      authorization: [{ actor: coop, permission: 'active' }],
      data: { payer: coop, receiver: coop, days, payment: `${payment.toFixed(precision)} ${symbol}`, transfer: false },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
  const bytes = (await ramQuota(coop)) - before
  if (bytes <= 0)
    throw new Error(`аренда на ${payment} ${symbol} не прибавила памяти кооперативу (долг до аренды ${debt} Б)`)

  return {
    payment_axon: payment,
    bytes_per_payment: bytes,
    powerup_days: days,
    axon_per_byte_day: payment / (bytes * days),
    expected_bytes_by_formula: Math.floor(payment * 10 ** precision / 2),
    ram_debt_before: debt,
  }
}
