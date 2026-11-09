/**
 * Контрактный уровень: инвестиционный этап кооперативного участка Стола
 * заказов на живой цепи (задача 99D-27; PRD компонента 68; реестр
 * marketplace.order, случаи mkt.order.invest.*).
 *
 * Инициаторы участка — его председатель и доверенное лицо. Тест проходит путь
 * паевые взносы целиком и сверяет состояние цепи с эталоном
 * `MarketContract.PeriodModel` (crps*):
 *
 *   • договор участия подписывается один раз, второй раз — отказ;
 *   • деньги транслируются с главного паевого на кошелёк договора участия без
 *     проводки; паевой взнос инициатора на счёте 80 не меняется, деньги лежат
 *     подушкой вне базы возврата;
 *   • имущество проходит заявление → одобрение председателя участка → решение
 *     совета → акт двумя подписями и сразу входит в базу возврата (Дт 10 / Кт 80);
 *   • прогон месяца с экономией: доля инициаторов возмещает паевые взносы
 *     (o.mkt.repay на кошелёк возмещения участка), счётчик возврата растёт
 *     ровно как в эталоне;
 *   • заявление обратно переводит на главный паевой ровно столько, сколько
 *     насчитал эталон; повтор без новой экономии — отказ;
 *   • отказы: без договора, не оператор участка, чужой подписант, больше
 *     паевого, пул и выход — только контракты branch и registrator.
 *
 * Документы теста — синтетические: контракт проверяет подписи и подписантов,
 * а не текст шаблона (шаблоны 1118–1123 — задача 99D-29).
 *
 * Номера периодов — от 4 280 000 000: настоящие месяцы всегда меньше. Свои
 * строки итога тест стирает. Требует стенда после `reboot:extra` с сид-фазами
 * docs-harness.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MarketContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { acceptToCoop, issueOrder, pickOffer, placeOrder } from './marketplace/orderFlow'
import { CHAIRMAN, COOP, type Who, amount, ensureShareFunds, fromState, loginAs, signAs, sumOf, waitForOps } from './marketplace/chainHelpers'
import { accumulationFunds, asset, chargeHash, closeMonthAndCompare, coopPusher, grownPeriod, investBranch, investorRow, memberDue, memberDues, rub, units, userWallet, waitPeriodEnd } from './marketplace/periodHelpers'
import { processDecision } from './soviet/processDecision'
import { signProgramAgreement } from './wallet/signProgramAgreement'
import { fakeDocument } from './shared/fakeDocument'

const { chargeRow, crpsClaimable, crpsRoute } = MarketContract.PeriodModel

/** Списание по итогу периода — только на стенде со сжатым временем (задача 99D-33); в настоящем времени случай 06 пропускается. */
const COMPRESSED = (Number(process.env.BLACKBOX_STAND_MONTH_SECONDS) || 0) > 0

const bc = new Blockchain(config.network, config.private_keys)
const push = coopPusher(bc)

const MARKET = MarketContract.contractName.production
const BRANAME = 'krg'

const chairkrg = fromState('chairkrg')
const trustedkrg = fromState('trustedkrg')
const ekaterina = fromState('ekaterina')
const sidorov = fromState('sidorov')

let chairmanToken = ''
let chairkrgToken = ''
let ekaterinaToken = ''
let sidorovToken = ''
let period = 0

const hex = () => crypto.randomBytes(32).toString('hex')

/** Синтетический документ с номером реестра: подписи настоящие, текста нет. */
function draft(registry_id: number) {
  return { hash: hex(), meta: { registry_id, created_at: new Date().toISOString() }, html: '', binary: '', format: 'pdf', full_title: '' }
}

/** Подписанный документ в форме действия цепи: meta — строкой. */
function chainDoc(signed: any) {
  return { ...signed, meta: typeof signed.meta === 'string' ? signed.meta : JSON.stringify(signed.meta) }
}

async function signed(who: Who, registry_id: number) {
  return chainDoc(await signAs(who.wif, draft(registry_id), who.account, 1))
}

async function ensureAgreement(who: Who) {
  const rows: any[] = await bc.getTableRows(MARKET, COOP, 'invagreemnts', 1, who.account, who.account)
  if (rows.some(r => r.username === who.account)) return
  await push(MARKET, 'signinvagr', { coopname: COOP, username: who.account, agreement: await signed(who, 1118) })
}

/** Программа «Стол заказов» в цепи (`_marketplace_program_id`). */
const MARKETPLACE_PROGRAM_ID = 2

/**
 * Соглашение программы «Стол заказов»: кошелёк договора участия `w.mkt.invest`
 * принадлежит этой программе, и ledger2 двигает его только у пайщика с
 * подписанным соглашением. Доверенное лицо участка засевом стенда к программе
 * не подключено — подписываем по черновику программы, как стол пайщика.
 */
async function ensureMarketplaceProgram(who: Who) {
  const users: any[] = await bc.getTableRows('wallet', COOP, 'users', 1, who.account, who.account)
  if (users.some(u => u.username === who.account && (u.programs ?? []).some((p: any) => Number(p.program_id) === MARKETPLACE_PROGRAM_ID))) return
  const [program]: any[] = await bc.getTableRows('soviet', COOP, 'programs', 1, String(MARKETPLACE_PROGRAM_ID), String(MARKETPLACE_PROGRAM_ID))
  await signProgramAgreement(bc, COOP, who.account, MARKETPLACE_PROGRAM_ID, Number(program.draft_id), fakeDocument)
}

/** Решение совета по повестке с этим хэшем — найти и утвердить голосами совета. */
async function decideByHash(hash: string) {
  const rows: any[] = await bc.getTableRows('soviet', COOP, 'decisions', 1000)
  const decision = rows.reverse().find(r => String(r.hash ?? '').toLowerCase() === hash.toLowerCase())
  expect(decision, 'совет получил вопрос о приёме имущества на повестку').toBeTruthy()
  await processDecision(bc, Number(decision.id))
}

describe('стол заказов — инвестиционный этап кооперативного участка (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    chairmanToken = await loginAs(CHAIRMAN)
    chairkrgToken = await loginAs(chairkrg)
    ekaterinaToken = await loginAs(ekaterina)
    sidorovToken = await loginAs(sidorov)
    await ensureShareFunds(chairkrg.account, 20_000, chairkrgToken)
  }, 600_000)

  afterAll(async () => {
    await push(MARKET, 'delperiod', { coopname: COOP, braname: BRANAME, period }).catch(() => {})
  })

  it('mkt.order.invest.01 — договор участия подписывается один раз; без договора паевой взнос не принимается', async () => {
    const rows: any[] = await bc.getTableRows(MARKET, COOP, 'invagreemnts', 1, ekaterina.account, ekaterina.account)
    if (!rows.some(r => r.username === ekaterina.account)) {
      await expect(push(MARKET, 'investmoney', {
        coopname: COOP, username: ekaterina.account, braname: BRANAME, invest_hash: hex(), amount: asset(rub(100)), statement: await signed(ekaterina, 1119),
      }), 'без договора').rejects.toThrow(/MARKETPLACE_INVAGR_REQUIRED/)
    }
    await ensureAgreement(chairkrg)
    await ensureMarketplaceProgram(trustedkrg)
    await ensureAgreement(trustedkrg)
    await ensureAgreement(ekaterina)
    await expect(push(MARKET, 'signinvagr', { coopname: COOP, username: chairkrg.account, agreement: await signed(chairkrg, 1118) }), 'второй договор')
      .rejects.toThrow(/MARKETPLACE_INVAGR_EXISTS/)
  }, 300_000)

  it('mkt.order.invest.02 — деньги в участок: с главного паевого на кошелёк договора участия, подушка вне базы возврата', async () => {
    const amountUnits = rub(5_000)
    const shareBefore = await userWallet(bc, 'w.wal.share', chairkrg.account)
    const investBefore = await userWallet(bc, 'w.mkt.invest', chairkrg.account)
    const branchBefore = await investBranch(bc, BRANAME)
    const rowBefore = await investorRow(bc, BRANAME, chairkrg.account)

    await push(MARKET, 'investmoney', {
      coopname: COOP, username: chairkrg.account, braname: BRANAME, invest_hash: hex(), amount: asset(amountUnits), statement: await signed(chairkrg, 1119),
    })

    expect(shareBefore - await userWallet(bc, 'w.wal.share', chairkrg.account), 'с главного паевого — ровно сумма заявления').toBe(amountUnits)
    expect(await userWallet(bc, 'w.mkt.invest', chairkrg.account) - investBefore, 'на кошелёк договора участия — ровно сумма').toBe(amountUnits)
    const branchAfter = await investBranch(bc, BRANAME)
    expect(branchAfter.unusedTotal - branchBefore.unusedTotal, 'деньги — подушка пула').toBe(amountUnits)
    expect(branchAfter.base, 'неиспользованные деньги в базу возврата не входят').toBe(branchBefore.base)
    const row = await investorRow(bc, BRANAME, chairkrg.account)
    expect(row!.money - (rowBefore?.money ?? 0n)).toBe(amountUnits)
  }, 300_000)

  it('mkt.order.invest.03 — отказы паевого взноса деньгами: не оператор участка, чужой подписант, больше паевого, нулевая сумма', async () => {
    const base = { coopname: COOP, braname: BRANAME, invest_hash: hex() }
    await expect(push(MARKET, 'investmoney', { ...base, username: ekaterina.account, amount: asset(rub(100)), statement: await signed(ekaterina, 1119) }), 'не оператор')
      .rejects.toThrow(/MARKETPLACE_INVEST_NOT_OPERATOR/)
    await expect(push(MARKET, 'investmoney', { ...base, username: chairkrg.account, amount: asset(rub(100)), statement: await signed(trustedkrg, 1119) }), 'подпись не того пайщика')
      .rejects.toThrow(/подписанта/)
    const share = await userWallet(bc, 'w.wal.share', chairkrg.account)
    await expect(push(MARKET, 'investmoney', { ...base, username: chairkrg.account, amount: asset(share + 1n), statement: await signed(chairkrg, 1119) }), 'больше паевого')
      .rejects.toThrow(/MARKETPLACE_INVEST_INSUFFICIENT/)
    await expect(push(MARKET, 'investmoney', { ...base, username: chairkrg.account, amount: asset(0n), statement: await signed(chairkrg, 1119) }), 'ноль')
      .rejects.toThrow(/MARKETPLACE_INVEST_AMOUNT_INVALID/)
  }, 300_000)

  it('mkt.order.invest.04 — имущество: заявление → одобрение председателем участка → совет → акт вносящего → подпись председателем совета через одобрение (отказа нет); сразу в базу возмещения', async () => {
    const price = rub(3_000)
    const propertyHash = hex()
    const investBefore = await userWallet(bc, 'w.mkt.invest', trustedkrg.account)
    const branchBefore = await investBranch(bc, BRANAME)

    await push(MARKET, 'createiprop', {
      coopname: COOP, username: trustedkrg.account, braname: BRANAME, property_hash: propertyHash, amount: asset(price),
      description: 'Холодильная витрина, 1 шт., исправна', statement: await signed(trustedkrg, 1120),
    })
    await expect(push(MARKET, 'act1iprop', { coopname: COOP, username: trustedkrg.account, property_hash: propertyHash, act: await signed(trustedkrg, 1122) }),
      'акт до решения совета').rejects.toThrow(/MARKETPLACE_IPROP_STATUS_INVALID/)
    await expect(push(MARKET, 'approveiprop', { coopname: COOP, braname: BRANAME, property_hash: propertyHash, approved_statement: await signed(trustedkrg, 1120), meta: '' }),
      'одобрение не председателем участка').rejects.toThrow(/подписанта/)

    await push(MARKET, 'approveiprop', { coopname: COOP, braname: BRANAME, property_hash: propertyHash, approved_statement: await signed(chairkrg, 1120), meta: '' })
    await decideByHash(propertyHash)
    const props: any[] = await bc.getTableRows(MARKET, COOP, 'invprops', 1000)
    expect(props.find(p => p.hash.toLowerCase() === propertyHash)?.status, 'совет принял решение').toBe('authorized')

    // Акт: вносящий подписывает первым — контракт создаёт одобрение в совете;
    // председатель совета подписывает тот же акт второй подписью, совет
    // вызывает marketplace::apprvipact (решение владельца 08.11.2026).
    const actDraft = draft(1122)
    const act1 = chainDoc(await signAs(trustedkrg.wif, actDraft, trustedkrg.account, 1))
    await push(MARKET, 'act1iprop', { coopname: COOP, username: trustedkrg.account, property_hash: propertyHash, act: act1 })
    const approvals: any[] = await bc.getTableRows('soviet', COOP, 'approvals', 1000)
    expect(approvals.some(a => a.approval_hash.toLowerCase() === propertyHash && a.callback_action_approve === 'apprvipact'), 'акт в запросах одобрения председателя').toBe(true)

    // Отказа в подписи акта нет: решение принял совет, подпись председателя —
    // техническое исполнение (решение владельца 08.11.2026).
    await expect(push('soviet', 'declineapprv', { coopname: COOP, username: CHAIRMAN.account, approval_hash: propertyHash, reason: 'Уточнить описание' }),
      'отказ председателя совета в подписи акта').rejects.toThrow(/MARKETPLACE_IPROP_ACT_DECLINE_FORBIDDEN/)

    const act2 = chainDoc(await signAs(CHAIRMAN.wif, actDraft, CHAIRMAN.account, 2, [act1]))
    await push('soviet', 'confirmapprv', { coopname: COOP, username: CHAIRMAN.account, approval_hash: propertyHash, approved_document: act2 })

    expect(await userWallet(bc, 'w.mkt.invest', trustedkrg.account) - investBefore, 'цена приёма — паевым взносом на кошелёк договора участия').toBe(price)
    const branchAfter = await investBranch(bc, BRANAME)
    expect(branchAfter.base - branchBefore.base, 'имущество сразу в базе возврата').toBe(price)
    const after: any[] = await bc.getTableRows(MARKET, COOP, 'invprops', 1000)
    expect(after.some(p => p.hash.toLowerCase() === propertyHash), 'заявление стёрто после второй подписи').toBe(false)
    const ops = await waitForOps(chairmanToken, propertyHash, ['o.mkt.iprop'])
    expect(units(sumOf(ops, 'o.mkt.iprop').toFixed(4))).toBe(price)
  }, 900_000)

  it('mkt.order.invest.05 — отказ председателя участка до совета стирает заявление', async () => {
    const propertyHash = hex()
    await push(MARKET, 'createiprop', {
      coopname: COOP, username: trustedkrg.account, braname: BRANAME, property_hash: propertyHash, amount: asset(rub(1_000)),
      description: 'Весы торговые', statement: await signed(trustedkrg, 1120),
    })
    await expect(push(MARKET, 'declineiprop', { coopname: COOP, braname: BRANAME, property_hash: propertyHash, reason: '' })).rejects.toThrow(/MARKETPLACE_IPROP_REASON_REQUIRED/)
    await push(MARKET, 'declineiprop', { coopname: COOP, braname: BRANAME, property_hash: propertyHash, reason: 'Не нужно участку' })
    const props: any[] = await bc.getTableRows(MARKET, COOP, 'invprops', 1000)
    expect(props.some(p => p.hash.toLowerCase() === propertyHash)).toBe(false)
  }, 300_000)

  it.skipIf(!COMPRESSED)('mkt.order.invest.06 — прогон с экономией: доля инициаторов возмещает паевые взносы, счётчик — как в эталоне; заявление обратно — сумма эталона', async () => {
    const offer = await pickOffer(chairmanToken, sidorov.account, BRANAME, 'Мёд цветочный')
    const unitPrice = amount(offer.price_per_unit)
    await ensureShareFunds(ekaterina.account, unitPrice * 4, ekaterinaToken)
    const placed = await placeOrder({ token: ekaterinaToken, who: ekaterina, offerId: offer.id, quantity: 1, braname: BRANAME })
    await acceptToCoop({
      supplierToken: sidorovToken, supplier: sidorov, operatorToken: chairkrgToken, operator: chairkrg,
      orderId: placed.orderId, braname: BRANAME, factQuantity: 1, factUnitPrice: unitPrice,
    })
    await waitForOps(chairmanToken, placed.orderHash, ['o.mkt.purch'])
    const duesBefore = await memberDues(bc, ekaterina.account, BRANAME)
    await issueOrder({
      blockchain: bc, operatorToken: chairkrgToken, operator: chairkrg, memberToken: ekaterinaToken, member: ekaterina,
      orderId: placed.orderId, braname: BRANAME, actualQuantity: 1, actualUnitPrice: unitPrice,
    })
    const ops = await waitForOps(chairmanToken, placed.orderHash, ['o.mkt.consum', 'o.mkt.todue'])
    const due = units(sumOf(ops, 'o.mkt.todue').toFixed(4))
    // Период строки пайщицы — по концу гарантии (счётчики списания, задача 99D-33); итог и списание — после его окончания.
    period = grownPeriod(duesBefore, await memberDues(bc, ekaterina.account, BRANAME), due)
    await waitPeriodEnd(bc, period)

    // Период без расходов: вся обеспечительная часть после фондов — экономия.
    const fundsPercent = (await accumulationFunds(bc)).reduce((s, f) => s + BigInt(f.percent), 0n)
    const cfg: any[] = await bc.getTableRows(MARKET, COOP, 'config', 1)
    const initiatorPercent = BigInt(cfg[0]?.initiator_share_percent ?? 618_000)
    const month = await closeMonthAndCompare({ bc, push, braname: BRANAME, fundsPercent, initiatorPercent },
      'период с экономией', { planned: 0n, aidPaid: rub(1_000_000_000) }, period)
    // Строка пайщицы за период — все её заказы участка за период; суммы контракт берёт из неё.
    const dueRow = await memberDue(bc, ekaterina.account, BRANAME, period)
    expect(dueRow, 'строка пайщицы ждёт списания').toBeDefined()
    const parts = chargeRow(
      { rateBranch: BigInt(month.row.rate_branch), rateFunds: BigInt(month.row.rate_funds), rateInitiator: BigInt(month.row.rate_initiator) },
      units(dueRow.due), units(dueRow.turnover), units(dueRow.retained),
    )

    const branchBefore = await investBranch(bc, BRANAME)
    expect(branchBefore.base > 0n, 'у участка есть использованный паевой взнос — имущество из случая 04').toBe(true)
    const route = crpsRoute(branchBefore, parts.initiator)
    const repayBefore = await userWallet(bc, 'w.mkt.repay', BRANAME)

    await push(MARKET, 'chargeperiod', { coopname: COOP, username: ekaterina.account, braname: BRANAME, period })

    const branchAfter = await investBranch(bc, BRANAME)
    expect(branchAfter.acc, 'счётчик возврата участка — как в эталоне').toBe(route.acc)
    const repayDelta = await userWallet(bc, 'w.mkt.repay', BRANAME) - repayBefore
    expect(repayDelta > 0n && repayDelta <= route.repay, 'возмещение на кошелёк возмещения участка').toBe(true)
    // Ноги списания — в нитке строки счётчика пайщицы (p.mkt.due), не заказа.
    const legs = await waitForOps(chairmanToken, chargeHash(ekaterina.account, BRANAME, period), ['o.mkt.repay'])
    expect(units(sumOf(legs, 'o.mkt.repay').toFixed(4))).toBe(route.repay)

    // Заявление обратно: сумма — эталон по строкам цепи, контракт считает сам.
    const row = await investorRow(bc, BRANAME, trustedkrg.account)
    const expected = crpsClaimable(branchAfter, row!)
    const shareBefore = await userWallet(bc, 'w.wal.share', trustedkrg.account)
    const investBefore = await userWallet(bc, 'w.mkt.invest', trustedkrg.account)
    if (expected.total > 0n) {
      await push(MARKET, 'claiminv', { coopname: COOP, username: trustedkrg.account, braname: BRANAME, claim_hash: hex(), statement: await signed(trustedkrg, 1123) })
      const moved = await userWallet(bc, 'w.wal.share', trustedkrg.account) - shareBefore
      expect(moved >= expected.total, 'на главный паевой — не меньше насчитанного эталоном (плюс прежние начисления)').toBe(true)
      expect(investBefore - await userWallet(bc, 'w.mkt.invest', trustedkrg.account), 'с кошелька договора участия — та же сумма').toBe(moved)
    }
    await expect(push(MARKET, 'claiminv', { coopname: COOP, username: trustedkrg.account, braname: BRANAME, claim_hash: hex(), statement: await signed(trustedkrg, 1123) }),
      'повтор без новой экономии').rejects.toThrow(/MARKETPLACE_INVEST_NOTHING_TO_CLAIM/)
  }, 1_200_000)

  it('mkt.order.invest.07 — пул и выход — только контракты branch и registrator', async () => {
    const data = { coopname: COOP, braname: BRANAME, amount: asset(rub(1)), hash: hex() }
    await expect(push(MARKET, 'fundipool', data)).rejects.toThrow(/missing authority of branch/)
    await expect(push(MARKET, 'unfundipool', data)).rejects.toThrow(/missing authority of branch/)
    await expect(push(MARKET, 'spentipool', data)).rejects.toThrow(/missing authority of branch/)
    await expect(push(MARKET, 'exitinv', { coopname: COOP, username: chairkrg.account })).rejects.toThrow(/missing authority of registrator/)
  }, 300_000)
})
