/**
 * Контрактный уровень: источник служебной записки кооперативного участка —
 * средства участка или средства инициаторов (задача 99D-28; PRD компонента
 * 68; реестр marketplace.order, случаи mkt.order.invest.exp.*).
 *
 * Председатель участка подаёт записку как обычно. Контракт branch выбирает
 * источник сам: общий кошелёк участка, а если на нём не хватает — средства
 * инициаторов (пул w.mkt.ipool, проводки по счёту вложений 08):
 *
 *   • записка больше общего кошелька — источник «средства инициаторов»:
 *     в цепи выделение o.mkt.ipool под хэш записки, резерв участка вырос,
 *     шасси расходов получило пул инициаторов источником;
 *   • записка больше общего кошелька и свободных средств инициаторов —
 *     BRANCH_EXPENSE_NO_FUNDS, записка не создаётся.
 *
 * Оплату, отчёт и возврат остатка по такой записке, а также материальную
 * помощь из средств инициаторов проверяет сквозной набор полигона
 * (задача 99D-32): они идут через совет и кассира.
 *
 * Требует стенда после `reboot:extra` с сид-фазами docs-harness.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { MarketContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { CHAIRMAN, COOP, type Who, ensureShareFunds, fromState, loginAs, signAs, sumOf, waitForOps } from './marketplace/chainHelpers'
import { asset, coopPusher, investBranch, rub, units, userWallet } from './marketplace/periodHelpers'

const bc = new Blockchain(config.network, config.private_keys)
const push = coopPusher(bc)

const MARKET = MarketContract.contractName.production
const BRANAME = 'krg'

const chairkrg = fromState('chairkrg')

let chairmanToken = ''
let chairkrgToken = ''

const hex = () => crypto.randomBytes(32).toString('hex')

async function signed(who: Who, registry_id: number) {
  const doc = { hash: hex(), meta: { registry_id }, html: '', binary: '', format: 'pdf', full_title: '' }
  const s: any = await signAs(who.wif, doc, who.account, 1)
  return { ...s, meta: JSON.stringify(s.meta) }
}

function item(amount: bigint) {
  return {
    item_hash: hex(), mechanics: 1, recipient_type: 2, recipient: 'voskhod',
    description: 'Аренда помещения участка', planned_amount: asset(amount), actual_amount: asset(0n), status: 0,
  }
}

async function createExpense(amount: bigint) {
  const expense_hash = hex()
  await push('branch', 'createexp', {
    coopname: COOP, braname: BRANAME, creator: chairkrg.account, expense_hash, items: [item(amount)], statement: await signed(chairkrg, 2010),
  })
  return expense_hash
}

describe('стол заказов — служебная записка участка из средств инициаторов (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    chairmanToken = await loginAs(CHAIRMAN)
    chairkrgToken = await loginAs(chairkrg)
  }, 600_000)

  it('mkt.order.invest.exp.01 — общего кошелька не хватает: записка идёт из средств инициаторов, резерв участка вырос', async () => {
    const common = await userWallet(bc, 'w.brn.common', BRANAME)
    const amount = common + rub(100)

    // Свободных средств инициаторов должно хватить на записку.
    const before = await investBranch(bc, BRANAME)
    const free = before.unusedTotal - before.reserved
    if (free < amount) {
      const need = amount - free
      await ensureShareFunds(chairkrg.account, Number(need / 10_000n) + 1_000, chairkrgToken)
      const agreements: any[] = await bc.getTableRows(MARKET, COOP, 'invagreemnts', 1, chairkrg.account, chairkrg.account)
      if (!agreements.some(r => r.username === chairkrg.account))
        await push(MARKET, 'signinvagr', { coopname: COOP, username: chairkrg.account, agreement: await signed(chairkrg, 1118) })
      await push(MARKET, 'investmoney', {
        coopname: COOP, username: chairkrg.account, braname: BRANAME, invest_hash: hex(), amount: asset(need), statement: await signed(chairkrg, 1119),
      })
    }
    const ready = await investBranch(bc, BRANAME)

    const expenseHash = await createExpense(amount)

    const after = await investBranch(bc, BRANAME)
    expect(after.reserved - ready.reserved, 'под записку выделены средства инициаторов').toBe(amount)
    expect(await userWallet(bc, 'w.brn.common', BRANAME), 'общий кошелёк участка не тронут').toBe(common)
    const rows: any[] = await bc.getTableRows('branch', COOP, 'expenses', 1000)
    expect(rows.find(r => r.hash.toLowerCase() === expenseHash)?.source, 'источник записки — пул инициаторов').toBe('w.mkt.ipool')
    const proposals: any[] = await bc.getTableRows('expense', COOP, 'proposals', 1000)
    expect(proposals.find(p => String(p.proposal_hash).toLowerCase() === expenseHash)?.source_wallet, 'шасси расходов получило пул инициаторов').toBe('w.mkt.ipool')
    const ops = await waitForOps(chairmanToken, expenseHash, ['o.mkt.ipool'])
    expect(units(sumOf(ops, 'o.mkt.ipool').toFixed(4))).toBe(amount)
  }, 900_000)

  it('mkt.order.invest.exp.02 — не хватает ни общего кошелька, ни средств инициаторов: BRANCH_EXPENSE_NO_FUNDS', async () => {
    const common = await userWallet(bc, 'w.brn.common', BRANAME)
    const b = await investBranch(bc, BRANAME)
    const free = b.unusedTotal - b.reserved
    const amount = (common > free ? common : free) + rub(1_000_000)
    await expect(createExpense(amount)).rejects.toThrow(/BRANCH_EXPENSE_NO_FUNDS/)
  }, 300_000)
})
