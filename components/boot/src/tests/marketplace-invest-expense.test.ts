/**
 * Контрактный уровень: источник служебной записки кооперативного участка —
 * средства участка или средства инициаторов (задача 99D-28; PRD компонента
 * 68; реестр marketplace.order, случаи mkt.order.invest.exp.*).
 *
 * Председатель участка подаёт записку как обычно. Контракт branch выбирает
 * источник сам: общий кошелёк участка, а если на нём не хватает — средства
 * инициаторов (пул w.mkt.ipool, проводки по счёту 08):
 *
 *   • записка больше общего кошелька — источник «средства инициаторов»:
 *     в цепи выделение o.mkt.ipool под хэш записки, резерв участка вырос,
 *     шасси расходов получило пул инициаторов источником;
 *   • записка больше общего кошелька и свободных средств инициаторов —
 *     BRANCH_EXPENSE_NO_FUNDS, записка не создаётся.
 *
 *   • записка из средств инициаторов проходит совет, оплачивается по
 *     реквизитам (o.mkt.idir, Дт 08 / Кт 51) и закрывается: оплаченное
 *     снимается с выделенного и входит в базу возврата паевых взносов.
 *
 * Материальная помощь: источник выбирается при подаче заявления — персональный
 * кошелёк доверенного (сумма переходит на кошелёк заявлений), а если его не
 * хватает — средства инициаторов (выделение под хэш заявления). Отказ совета
 * возвращает сумму в источник, выбранный при подаче; не хватает ни того, ни другого —
 * BRANCH_AID_INSUFFICIENT. Аванс под отчёт с возвратом остатка проверяет полигон.
 *
 * Требует стенда после `reboot:extra` с сид-фазами docs-harness.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GatewayContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { CHAIRMAN, COOP, fromState, loginAs, sumOf, waitForOps } from './marketplace/chainHelpers'
import { aidStatement, coopWallet, ensurePoolFree as ensurePoolFreeBy, hex, signedDoc as signed } from './marketplace/investHelpers'
import { asset, coopPusher, investBranch, rub, units, userWallet } from './marketplace/periodHelpers'
import { declineDecision, processDecision } from './soviet/processDecision'

const bc = new Blockchain(config.network, config.private_keys)
const push = coopPusher(bc)

const BRANAME = 'krg'

const chairkrg = fromState('chairkrg')
const trustedkrg = fromState('trustedkrg')

let chairmanToken = ''
let chairkrgToken = ''

function item(amount: bigint) {
  return {
    item_hash: hex(),
    mechanics: 1,
    recipient_type: 2,
    recipient: 'voskhod',
    description: 'Аренда помещения участка',
    planned_amount: asset(amount),
    actual_amount: asset(0n),
    status: 0,
  }
}

/** Последняя записка из средств инициаторов: её проводит по шасси случай exp.03. */
let poolExpense: { hash: string, itemHash: string, amount: bigint } | null = null

async function createExpense(amount: bigint) {
  const expense_hash = hex()
  const it = item(amount)
  await push('branch', 'createexp', {
    coopname: COOP,
    braname: BRANAME,
    creator: chairkrg.account,
    expense_hash,
    items: [it],
    statement: await signed(chairkrg, 2010),
  })
  poolExpense = { hash: expense_hash, itemHash: it.item_hash, amount }
  return expense_hash
}

/** Свободных средств инициаторов участка не меньше суммы: председатель участка вносит недостающее. */
async function ensurePoolFree(amount: bigint) {
  await ensurePoolFreeBy(bc, chairkrg, chairkrgToken, BRANAME, amount)
}

/** Решение совета по повестке с этим хэшем — найти и отклонить большинством голосов совета. */
async function declineByHash(hash: string) {
  const rows: any[] = await bc.getTableRows('soviet', COOP, 'decisions', 1000)
  const decision = rows.reverse().find(r => String(r.hash ?? '').toLowerCase() === hash.toLowerCase())
  expect(decision, 'заявление вынесено на совет').toBeTruthy()
  await declineDecision(bc, Number(decision.id))
}

/** Решение совета по повестке с этим хэшем — найти и утвердить голосами совета. */
async function decideByHash(hash: string) {
  const rows: any[] = await bc.getTableRows('soviet', COOP, 'decisions', 1000)
  const decision = rows.reverse().find(r => String(r.hash ?? '').toLowerCase() === hash.toLowerCase())
  expect(decision, 'записка вынесена на совет').toBeTruthy()
  await processDecision(bc, Number(decision.id))
}

/** Ожидание состояния цепи: блок с транзакцией разбирается не мгновенно. */
async function poll<T>(probe: () => Promise<T | null>, label: string, timeoutMs = 120_000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const v = await probe()
    if (v !== null)
      return v
    // timing: backoff — опрос цепи до появления состояния
    await new Promise(r => setTimeout(r, 1500))
  }
  throw new Error(`не дождались: ${label}`)
}

async function proposalOf(hash: string): Promise<any | undefined> {
  const rows: any[] = await bc.getTableRows('expense', COOP, 'proposals', 1000)
  return rows.find(p => String(p.proposal_hash).toLowerCase() === hash.toLowerCase())
}

/** Строка заявления на материальную помощь по хэшу; после отказа совета её нет. */
async function aidRow(hash: string): Promise<any | undefined> {
  const rows: any[] = await bc.getTableRows('branch', COOP, 'aids', 1000)
  return rows.find(r => String(r.hash).toLowerCase() === hash)
}

/**
 * Предел материальной помощи доверенному не мешает заявлению на эту сумму:
 * потолок и резерв поднимаются на уже заявленное в этом месяце плюс сумму.
 */
async function allowAid(amount: bigint) {
  const months: any[] = await bc.getTableRows('branch', COOP, 'aidmonths', 1000)
  const already = units(months.find(m => m.username === trustedkrg.account)?.total)
  const cap = asset(already + amount + rub(1))
  await push('branch', 'setaidlimit', { coopname: COOP, limit: cap })
  await push('branch', 'setreserve', { coopname: COOP, braname: BRANAME, username: trustedkrg.account, amount: cap })
}

async function fileAid(hash: string, amount: bigint) {
  return push('branch', 'createaid', {
    coopname: COOP,
    username: trustedkrg.account,
    braname: BRANAME,
    aid_hash: hash,
    amount: asset(amount),
    statement: aidStatement(trustedkrg, hash),
    meta: '{}',
  })
}

describe('стол заказов — служебная записка участка из средств инициаторов (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    chairmanToken = await loginAs(CHAIRMAN)
    chairkrgToken = await loginAs(chairkrg)
  }, 600_000)

  afterAll(async () => {
    // Стенд — прежний: резерв доверенного снят, потолок материальной помощи ноль.
    await push('branch', 'delreserve', { coopname: COOP, braname: BRANAME, username: trustedkrg.account }).catch(() => {})
    await push('branch', 'setaidlimit', { coopname: COOP, limit: asset(0n) }).catch(() => {})
  })

  it('mkt.order.invest.exp.01 — общего кошелька не хватает: записка идёт из средств инициаторов, резерв участка вырос', async () => {
    const common = await userWallet(bc, 'w.brn.common', BRANAME)
    const amount = common + rub(100)

    // Свободных средств инициаторов должно хватить на записку.
    await ensurePoolFree(amount)
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

  it('mkt.order.invest.exp.03 — записка из средств инициаторов проходит совет, оплачивается по реквизитам и закрывается: оплаченное входит в базу возврата', async () => {
    expect(poolExpense, 'записка из случая exp.01').toBeTruthy()
    const { hash, itemHash, amount } = poolExpense!
    const before = await investBranch(bc, BRANAME)
    const common = await userWallet(bc, 'w.brn.common', BRANAME)
    const spentOf = (b: Awaited<ReturnType<typeof investBranch>>) => units(b.raw?.spent_total)

    // Робот совета мог утвердить записку сам и стереть строку решения.
    const authorized = async () => Number((await proposalOf(hash))?.status ?? -1) >= 1
    if (!(await authorized()))
      await decideByHash(hash)
    await poll(async () => ((await authorized()) ? true : null), 'совет утвердил записку')
    // Прямая оплата организации: подотчёта нет, позиция сразу закрыта отчётом.
    await push('expense', 'payexp', { coopname: COOP, proposal_hash: hash, item_hash: itemHash, actual_amount: asset(amount) })
    const ops = await waitForOps(chairmanToken, hash, ['o.mkt.ipool', 'o.mkt.idir'])
    expect(units(sumOf(ops, 'o.mkt.idir').toFixed(4)), 'оплата из средств инициаторов — проводка Дт 08 / Кт 51').toBe(amount)
    expect(await userWallet(bc, 'w.brn.common', BRANAME), 'общий кошелёк участка не тронут').toBe(common)

    await push('expense', 'closeexp', { coopname: COOP, proposal_hash: hash })
    const after = await poll(async () => {
      const b = await investBranch(bc, BRANAME)
      return spentOf(b) - spentOf(before) === amount ? b : null
    }, 'расход закрыт: средства инициаторов израсходованы')
    expect(before.reserved - after.reserved, 'выделенное под записку снято').toBe(amount)
    expect(before.unusedTotal - after.unusedTotal, 'неизрасходованные деньги инициаторов уменьшились').toBe(amount)
    expect(after.base - before.base, 'оплаченное вошло в базу возврата паевых взносов').toBe(amount)
  }, 900_000)

  it('mkt.order.invest.aid.01 — персонального кошелька не хватает: совет одобряет помощь из средств инициаторов, кассир выплачивает — налог и сумма на руки по счёту 08, вся сумма в базе возврата', async () => {
    const personal = await userWallet(bc, 'w.brn.person', trustedkrg.account)
    const amount = personal + rub(100)
    await ensurePoolFree(amount)
    // Резерв получателя — предел материальной помощи за месяц.
    await allowAid(amount)
    const before = await investBranch(bc, BRANAME)

    const aidHash = hex()
    await fileAid(aidHash, amount)
    // Средства выделяются при подаче: свободные средства инициаторов меньше уже до решения совета.
    expect((await investBranch(bc, BRANAME)).reserved - before.reserved, 'при подаче выделены средства инициаторов').toBe(amount)
    if ((await aidRow(aidHash))?.status !== 'authorized')
      await decideByHash(aidHash)
    const authorized = await poll(async () => {
      const r = await aidRow(aidHash)
      return r?.status === 'authorized' ? r : null
    }, 'совет одобрил помощь')
    expect(authorized.source, 'источник помощи — средства инициаторов').toBe('w.mkt.ipool')
    expect((await investBranch(bc, BRANAME)).reserved - before.reserved, 'под помощь выделены средства инициаторов').toBe(amount)

    // Кассир подтверждает выплату банковским переводом.
    await push(GatewayContract.contractName.production, GatewayContract.Actions.CompleteOutcome.actionName, { coopname: COOP, outcome_hash: aidHash })
    const ops = await waitForOps(chairmanToken, aidHash, ['o.mkt.iaid', 'o.mkt.iaidtx'])
    const tax = units(sumOf(ops, 'o.mkt.iaidtx').toFixed(4))
    const net = units(sumOf(ops, 'o.mkt.iaid').toFixed(4))
    expect(tax + net, 'налог Дт 08 / Кт 68 и на руки Дт 08 / Кт 51 — вся сумма заявления').toBe(amount)
    expect(tax % 10_000n, 'налог округлён до рубля').toBe(0n)
    expect(await userWallet(bc, 'w.brn.person', trustedkrg.account), 'персональный кошелёк не тронут').toBe(personal)
    const after = await poll(async () => {
      const b = await investBranch(bc, BRANAME)
      return b.base - before.base === amount ? b : null
    }, 'помощь вошла в базу возврата паевых взносов')
    expect(after.reserved, 'выделенное под помощь снято').toBe(before.reserved)
  }, 900_000)

  it('mkt.order.invest.aid.02 — совет отказал в помощи из средств инициаторов: выделенное при подаче снимается, заявление закрыто', async () => {
    const personal = await userWallet(bc, 'w.brn.person', trustedkrg.account)
    const amount = personal + rub(50)
    await ensurePoolFree(amount)
    await allowAid(amount)
    const before = await investBranch(bc, BRANAME)

    const aidHash = hex()
    await fileAid(aidHash, amount)
    expect((await aidRow(aidHash))?.source, 'источник выбран при подаче — средства инициаторов').toBe('w.mkt.ipool')
    expect((await investBranch(bc, BRANAME)).reserved - before.reserved, 'при подаче выделены средства инициаторов').toBe(amount)

    await declineByHash(aidHash)
    await poll(async () => ((await aidRow(aidHash)) ? null : true), 'заявление закрыто отказом совета')
    expect((await investBranch(bc, BRANAME)).reserved, 'выделенное под помощь вернулось в свободные средства инициаторов').toBe(before.reserved)
    expect(await userWallet(bc, 'w.brn.person', trustedkrg.account), 'персональный кошелёк не тронут').toBe(personal)
  }, 900_000)

  it('mkt.order.invest.aid.03 — персонального кошелька хватает: сумма при подаче переходит на кошелёк заявлений, отказ совета возвращает её', async (ctx) => {
    const amount = rub(1)
    if (await userWallet(bc, 'w.brn.person', trustedkrg.account) < amount) {
      // Персональный кошелёк пополняется распределением общего кошелька участка
      // по отдельной группе весов, где доверенный один и получает всю сумму.
      if (await userWallet(bc, 'w.brn.common', BRANAME) < amount) {
        ctx.skip()
        return
      }
      const group = { coopname: COOP, braname: BRANAME, contract: 'aidtest', username: trustedkrg.account }
      await push('branch', 'setweight', { ...group, weight: 1 })
      await push('branch', 'distribute', {
        coopname: COOP,
        braname: BRANAME,
        source_contract: 'aidtest',
        round_hash: hex(),
        amount: asset(amount),
        memo: 'Пополнение персонального кошелька для проверки материальной помощи',
      })
      await push('branch', 'delweight', group)
    }
    await allowAid(amount)
    const personal = await userWallet(bc, 'w.brn.person', trustedkrg.account)
    const pending = await coopWallet(bc, 'w.brn.aidreq')
    const before = await investBranch(bc, BRANAME)

    const aidHash = hex()
    await fileAid(aidHash, amount)
    expect((await aidRow(aidHash))?.source, 'источник выбран при подаче — персональный кошелёк').toBe('w.brn.aidreq')
    expect(await userWallet(bc, 'w.brn.person', trustedkrg.account), 'свободный остаток персонального кошелька уменьшился при подаче').toBe(personal - amount)
    expect(await coopWallet(bc, 'w.brn.aidreq'), 'сумма заявления на кошельке заявлений').toBe(pending + amount)
    expect((await investBranch(bc, BRANAME)).reserved, 'средства инициаторов не тронуты').toBe(before.reserved)
    const ops = await waitForOps(chairmanToken, aidHash, ['o.brn.aidreq'])
    expect(units(sumOf(ops, 'o.brn.aidreq').toFixed(4))).toBe(amount)

    await declineByHash(aidHash)
    await poll(async () => ((await aidRow(aidHash)) ? null : true), 'заявление закрыто отказом совета')
    expect(await userWallet(bc, 'w.brn.person', trustedkrg.account), 'отказ совета вернул сумму на персональный кошелёк').toBe(personal)
    expect(await coopWallet(bc, 'w.brn.aidreq'), 'кошелёк заявлений вернулся к прежнему остатку').toBe(pending)
  }, 900_000)

  it('mkt.order.invest.aid.04 — не хватает ни персонального кошелька, ни средств инициаторов: BRANCH_AID_INSUFFICIENT, заявление не создаётся', async () => {
    const personal = await userWallet(bc, 'w.brn.person', trustedkrg.account)
    const b = await investBranch(bc, BRANAME)
    const free = b.unusedTotal - b.reserved
    const amount = (personal > free ? personal : free) + rub(1_000)
    await allowAid(amount)
    const aidHash = hex()
    await expect(fileAid(aidHash, amount)).rejects.toThrow(/BRANCH_AID_INSUFFICIENT/)
    expect(await aidRow(aidHash), 'заявления нет').toBeUndefined()
  }, 300_000)

  it('mkt.order.invest.exp.02 — не хватает ни общего кошелька, ни средств инициаторов: BRANCH_EXPENSE_NO_FUNDS', async () => {
    const common = await userWallet(bc, 'w.brn.common', BRANAME)
    const b = await investBranch(bc, BRANAME)
    const free = b.unusedTotal - b.reserved
    const amount = (common > free ? common : free) + rub(1_000_000)
    await expect(createExpense(amount)).rejects.toThrow(/BRANCH_EXPENSE_NO_FUNDS/)
  }, 300_000)
})
