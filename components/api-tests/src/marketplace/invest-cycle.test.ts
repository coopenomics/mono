/**
 * Возмещение вложений инициаторов участка из экономии — снаружи, на стенде
 * со сжатым временем (реестр marketplace.order, mkt.order.invest.istok.01,
 * .07, .08; задачи 99D-30, 99D-32).
 *
 * Набор идёт фазой keu полигона вместе с period-cycle (scripts/blackbox/stack.sh):
 * прогон первого числа делает крон узла по шкале STAND_MONTH_SECONDS. У
 * председателя участка krg должно быть использованное вложение — имущество в
 * базе возврата; если его нет, набор вносит имущество через совет сам. Резерв
 * председателя участка набор снимает до заказа, поэтому месяц без недостачи
 * и доля инициаторов идёт на возмещение вложений.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, ROLES, amount, availableShare, caseName, docMeta, gql, signDocument, tokenOf, waitFor } from '../core'
import { KRG, pickOffer } from './flow'
import { type IssuedOrder, issuedOrder, refusal } from './mkt-flows.helpers'
import { BRANCH_INVESTMENT, MY_INVESTMENTS, chainInvestment, contractClaimable, ensureAgreement, investPropertyAccepted, unitsOf } from './invest.helpers'

const STAND_MONTH_SECONDS = Number(process.env.BLACKBOX_STAND_MONTH_SECONDS) || 0
const COMPRESSED = STAND_MONTH_SECONDS > 0

const chairkrg = ROLES.branchChairman()
const ekaterina = ROLES.member()
const sidorov = ROLES.supplier()

const SET_INITIATOR_SHARE = 'mutation($d:MarketplaceSetInitiatorShareInput!){ marketplaceSetInitiatorShare(data:$d){ initiator_share_percent } }'
const DEL_RESERVE = 'mutation($d:MarketplaceDeleteBranchReserveInput!){ marketplaceDeleteBranchReserve(data:$d){ rows{ username } } }'
const PERIODS = `query($b:String!,$o:PaginationInput){ marketplaceListBranchPeriods(braname:$b, options:$o){ items{
  period secured expenses deficit initiator_amount invest_phase investor_repaid rows_total rows_charged } } }`
const SECURE_PART = 'query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ secure_part{ state } } }'
const INBOX = `query($c:String!,$p:PaginationInput!){ getInboxNotifications(coopname:$c, pagination:$p){
  items{ id workflowId payload createdAt } } }`
const RETURNED_WORKFLOW = 'vlozhenie-vozmeshcheno'
const PROPERTY_SUM = 100_000

function standPeriodNow(): number {
  return Math.floor(Date.now() / 1000 / STAND_MONTH_SECONDS)
}

function secondsLeftInStandMonth(): number {
  return STAND_MONTH_SECONDS - ((Date.now() / 1000) % STAND_MONTH_SECONDS)
}

/** Заказу с приёмкой и выдачей нужно уложиться в один месяц стенда. */
const ORDER_BUDGET_SECONDS = Math.min(150, Math.floor(STAND_MONTH_SECONDS / 2))

let krgToken = ''
let memberToken = ''
let order: IssuedOrder
let ordersPeriod = 0
let periodRow: any = null
let repaidBefore = 0

describe.skipIf(!COMPRESSED)('возмещение вложений инициаторов участка — прогон на стенде со сжатым временем', () => {
  beforeAll(async () => {
    krgToken = await tokenOf(chairkrg)
    memberToken = await tokenOf(ekaterina)
    const chairmanToken = await tokenOf(CHAIRMAN)
    await gql(chairmanToken, SET_INITIATOR_SHARE, { d: { initiator_share_percent: 61.8 } })
    await gql(krgToken, DEL_RESERVE, { d: { braname: KRG, username: chairkrg.account } }).catch(() => {})
    await ensureAgreement(chairkrg)
    // В базе возврата нужно использованное вложение самого председателя участка:
    // имущество входит в базу сразу. Деньги без расхода в базу не входят.
    const view = (await gql<any>(krgToken, BRANCH_INVESTMENT, { b: KRG })).marketplaceBranchInvestment
    const own = (view.investors as any[]).find(i => i.username === chairkrg.account)
    if (!own || amount(own.property) <= 0)
      await investPropertyAccepted({ investor: chairkrg, chairman: chairkrg, braname: KRG, sum: PROPERTY_SUM, name: `Весы торговые ${Date.now().toString(36)}` })
    repaidBefore = amount((await gql<any>(krgToken, BRANCH_INVESTMENT, { b: KRG })).marketplaceBranchInvestment.repaid_total)
  }, 600_000)

  it(caseName('mkt.order.invest.istok.07', 'итог месяца участка с вложениями: фаза возмещения, возмещение за прогон растёт по списанным строкам'), async () => {
    const offer = await pickOffer(sidorov.account, KRG)
    if (secondsLeftInStandMonth() < ORDER_BUDGET_SECONDS) {
      // timing: schedule — ждём первое число стенда, чтобы заказ выдали внутри одного месяца
      await new Promise(resolve => setTimeout(resolve, (secondsLeftInStandMonth() + 2) * 1000))
    }
    ordersPeriod = standPeriodNow()
    order = await issuedOrder({ member: ekaterina, supplier: sidorov, operator: chairkrg, offer, quantity: 2 })
    expect(standPeriodNow(), 'заказ выдан в одном месяце стенда').toBe(ordersPeriod)

    periodRow = await waitFor(async () => {
      const d = await gql<any>(krgToken, PERIODS, { b: KRG, o: { page: 1, limit: 5, sortOrder: 'DESC' } })
      return (d.marketplaceListBranchPeriods.items as any[]).find(r => Number(r.period) === ordersPeriod) ?? null
    }, { timeoutMs: STAND_MONTH_SECONDS * 2_500, intervalMs: 3_000, label: 'итог месяца участка krg' })
    expect(amount(periodRow.deficit), 'резерва и записок нет — месяц без недостачи').toBe(0)
    expect(periodRow.invest_phase, 'вложения не возвращены — доля инициаторов возмещает их').toBe('REPAYING')
    expect(amount(periodRow.initiator_amount), 'доля инициаторов за месяц есть').toBeGreaterThan(0)

    await waitFor(async () => {
      const sp = (await gql<any>(memberToken, SECURE_PART, { i: { order_id: order.orderId } })).marketplaceGetOrder.secure_part
      return sp?.state === 'CHARGED' ? true : null
    }, { timeoutMs: 180_000, intervalMs: 3_000, label: `списание заказа ${order.orderId}` })
    periodRow = await waitFor(async () => {
      const d = await gql<any>(krgToken, PERIODS, { b: KRG, o: { page: 1, limit: 5, sortOrder: 'DESC' } })
      const row = (d.marketplaceListBranchPeriods.items as any[]).find(r => Number(r.period) === ordersPeriod)
      return row && amount(row.investor_repaid) > 0 ? row : null
    }, { timeoutMs: 120_000, intervalMs: 3_000, label: 'возмещение за прогон в итоге месяца' })
    expect(amount(periodRow.investor_repaid), 'возмещено не больше доли инициаторов').toBeLessThanOrEqual(amount(periodRow.initiator_amount) + 0.0001)
    const view = (await gql<any>(krgToken, BRANCH_INVESTMENT, { b: KRG })).marketplaceBranchInvestment
    expect(amount(view.repaid_total) - repaidBefore, 'возмещение участка выросло').toBeGreaterThan(0)
  }, 60 * 60_000)

  it(caseName('mkt.order.invest.istok.01', 'после возмещения доступное инициатору — ровно формула контракта на строках цепи'), async () => {
    const mine = (await gql<any>(krgToken, MY_INVESTMENTS)).marketplaceMyInvestments.find((i: any) => i.braname === KRG)
    const { branch, investor } = await chainInvestment(KRG, chairkrg.account)
    expect(unitsOf(mine.claimable)).toBe(contractClaimable(branch, investor))
    expect(unitsOf(mine.claimable), 'возмещённое доступно к трансляции').toBeGreaterThan(0n)
  })

  it(caseName('mkt.order.invest.istok.08', 'инициатору приходит уведомление о возмещении со ссылкой на страницу «Инициаторы участка»'), async () => {
    const note = await waitFor(async () => {
      const d = await gql<any>(krgToken, INBOX, { c: COOP, p: { page: 1, limit: 50, sortOrder: 'DESC' } })
      return (d.getInboxNotifications.items as any[]).find(i => i.workflowId === RETURNED_WORKFLOW) ?? null
    }, { timeoutMs: 120_000, intervalMs: 2_000, label: 'уведомление о возмещении вложения' })
    const payload = typeof note.payload === 'string' ? JSON.parse(note.payload) : note.payload
    expect(String(payload.deepLinkUrl ?? '')).toContain('/market-pvz/initiators')
    expect(String(payload.amount ?? '')).not.toBe('')
  })

  it(caseName('mkt.order.invest.cycle.02', 'заявление обратно: возвращённое переведено на главный паевой кошелёк ровно суммой предпросмотра; повтор — отказ'), async () => {
    const CLAIM_DOC = 'query($b:String!){ marketplaceInvestClaimSignablePayload(braname:$b){ full_title html hash meta binary } }'
    const CLAIM = 'mutation($d:MarketplaceClaimInvestmentInput!){ marketplaceClaimInvestment(data:$d){ braname claimed claimable } }'
    const before = (await gql<any>(krgToken, MY_INVESTMENTS)).marketplaceMyInvestments.find((i: any) => i.braname === KRG)
    const preview = unitsOf(before.claimable)
    expect(preview > 0n).toBe(true)
    const shareBefore = await availableShare(chairkrg.account)

    const doc = (await gql<any>(krgToken, CLAIM_DOC, { b: KRG })).marketplaceInvestClaimSignablePayload
    const statement = await signDocument(chairkrg.wif, doc, chairkrg.account, 1)
    const after = (await gql<any>(krgToken, CLAIM, { d: { braname: KRG, claim_hash: String(docMeta(doc.meta).claim_hash), statement } })).marketplaceClaimInvestment
      .find((i: any) => i.braname === KRG)

    // Деньги — по кошельку цепи, не по ответу API.
    const shareAfter = await waitFor(async () => {
      const v = await availableShare(chairkrg.account)
      return v > shareBefore ? v : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'главный паевой кошелёк после заявления обратно' })
    expect(BigInt(Math.round((shareAfter - shareBefore) * 10_000))).toBe(preview)
    expect(unitsOf(after.claimed) - unitsOf(before.claimed)).toBe(preview)
    expect(unitsOf(after.claimable)).toBe(0n)

    const again = await refusal(krgToken, CLAIM_DOC, { b: KRG })
    expect(again?.codeText ?? '').toMatch(/MARKETPLACE_INVEST_NOTHING_TO_CLAIM/)
  })
})
