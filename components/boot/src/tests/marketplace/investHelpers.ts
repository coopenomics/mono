/**
 * Общие помощники тестов инвестиционного этапа участка и материальной помощи:
 * подписанные документы, заявление на помощь и пополнение средств инициаторов.
 * Ими пользуются тесты резерва участка и расходов из средств инициаторов.
 */
import crypto from 'node:crypto'
import ecc from 'eosjs-ecc'
import { MarketContract } from 'cooptypes'
import type Blockchain from '../../blockchain'
import { COOP, type Who, ensureShareFunds, signAs } from './chainHelpers'
import { asset, coopPusher, investBranch, userWallet } from './periodHelpers'

const MARKET = MarketContract.contractName.production

export const hex = () => crypto.randomBytes(32).toString('hex')

/** Документ с номером реестра, подписанный ключом пайщика. */
export async function signedDoc(who: Who, registry_id: number) {
  const doc = { hash: hex(), meta: { registry_id }, html: '', binary: '', format: 'pdf', full_title: '' }
  const s: any = await signAs(who.wif, doc, who.account, 1)
  return { ...s, meta: JSON.stringify(s.meta) }
}

/** Заявление на материальную помощь, подписанное ключом получателя (контракт сверяет ключ подписанта). */
export function aidStatement(who: Who, hash: string) {
  return {
    version: '1.0.0',
    hash,
    doc_hash: hash,
    meta_hash: hash,
    meta: '{}',
    signatures: [{
      id: 1,
      signed_hash: hash,
      signer: who.account,
      public_key: ecc.privateToPublic(who.wif),
      signature: ecc.signHash(hash, who.wif),
      signed_at: new Date().toISOString().slice(0, 19),
      meta: '{}',
    }],
  }
}

/** Остаток кошелька кооператива (не пайщика) в единицах актива. */
export async function coopWallet(bc: Blockchain, wallet: string): Promise<bigint> {
  const rows: any[] = await bc.getTableRows('ledger2', COOP, 'wallets', 500)
  const row = rows.find(r => String(r.id) === wallet)
  return row ? BigInt(Math.round(Number.parseFloat(String(row.available)) * 10_000)) : 0n
}

/**
 * Свободных средств инициаторов участка не меньше суммы: недостающее вносит
 * пайщик `who` (председатель участка) паевым взносом в участок.
 */
export async function ensurePoolFree(bc: Blockchain, who: Who, token: string, braname: string, amount: bigint) {
  const push = coopPusher(bc)
  const b = await investBranch(bc, braname)
  const free = b.unusedTotal - b.reserved
  if (free >= amount)
    return
  const need = amount - free
  await ensureShareFunds(who.account, Number(need / 10_000n) + 1_000, token)
  // Договор об участии заключается на каждый участок (решение владельца 12.11.2026).
  const agreements: any[] = await bc.getTableRows(MARKET, COOP, 'invagrbranch', 1000)
  if (!agreements.some(r => r.username === who.account && r.braname === braname))
    await push(MARKET, 'signinvagr', { coopname: COOP, username: who.account, braname, agreement: await signedDoc(who, 1118) })
  await push(MARKET, 'investmoney', {
    coopname: COOP,
    username: who.account,
    braname,
    invest_hash: hex(),
    amount: asset(need),
    statement: await signedDoc(who, 1119),
  })
}

/**
 * Средств на заявление на материальную помощь хватает: контракт берёт сумму с
 * персонального кошелька получателя, а если его не хватает — из свободных
 * средств инициаторов участка. Персонального нет — пополняются средства
 * инициаторов.
 */
export async function ensureAidFunds(bc: Blockchain, recipient: Who, initiator: Who, initiatorToken: string, braname: string, amount: bigint) {
  if (await userWallet(bc, 'w.brn.person', recipient.account) >= amount)
    return
  await ensurePoolFree(bc, initiator, initiatorToken, braname, amount)
}
