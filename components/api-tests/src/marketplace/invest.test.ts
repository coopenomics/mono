/**
 * Инвестиционный этап кооперативного участка снаружи, в настоящем времени
 * (реестр marketplace.order, случаи mkt.order.invest.istok.*): договор
 * участия, заявление о вложении деньгами, вложение председателем участка и
 * имуществом через совет, отказы постороннему и пайщику без договора.
 *
 * Возмещение из экономии участка требует прогона первого числа — его ведёт
 * набор invest-cycle на стенде со сжатым временем. Стенд общий: суммы
 * сверяются приращениями.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ROLES, type Who, amount, caseName, ensureShareFunds, freshMember, gql, tokenOf } from '../core'
import { KRG } from './flow'
import { refusal } from './mkt-flows.helpers'
import { onboardOrderer } from './onboarding.helpers'
import {
  BRANCH_INVESTMENT,
  INVEST_MONEY,
  MY_AGREEMENT,
  MY_HISTORY,
  MY_INVESTMENTS,
  chainInvestment,
  contractClaimable,
  ensureAgreement,
  investMoney,
  investPropertyAccepted,
  investStatement,
  unitsOf,
} from './invest.helpers'

const chairkrg = ROLES.branchChairman()
const chairodn = ROLES.foreignBranchChairman()
const ODN = 'odn'
const SUM = 1_000
const PROPERTY_SUM = 25_000

let krgToken = ''
let outsider: Who
let outsiderToken = ''

const investorOf = (view: any, username: string) => (view.investors as any[]).find(i => i.username === username)

describe('инвестиционный этап участка: договор, вложения деньгами и имуществом', () => {
  beforeAll(async () => {
    krgToken = await tokenOf(chairkrg)
    outsider = freshMember({ prefix: 'inv' })
    await onboardOrderer(outsider, KRG)
    outsiderToken = await tokenOf(outsider)
  }, 600_000)

  it(caseName('mkt.order.invest.istok.05', 'оператор участка без договора участия: заявления не формируются, договора нет'), async () => {
    // Председатель чужого участка — оператор своего участка odn, договора не подписывал.
    const token = await tokenOf(chairodn)
    expect((await gql<any>(token, MY_AGREEMENT)).marketplaceMyInvestAgreement, 'договора у председателя участка odn нет').toBeNull()
    const r = await refusal(token, 'query($b:String!){ marketplaceInvestClaimSignablePayload(braname:$b){ hash } }', { b: ODN })
    expect(r?.codeText ?? '').toMatch(/MARKETPLACE_INVAGR_REQUIRED/)
  })

  it(caseName('mkt.order.invest.istok.06', 'председатель участка с договором: заявление 1119 с номером договора, участком и суммой'), async () => {
    const number = await ensureAgreement(chairkrg)
    expect(number).toMatch(/^[0-9A-F]{8}$/)
    const again = (await gql<any>(krgToken, MY_AGREEMENT)).marketplaceMyInvestAgreement
    expect(again.number, 'договор один на пайщика: номер не меняется').toBe(number)
    const { meta } = await investStatement(chairkrg, KRG, SUM)
    expect(Number(meta.registry_id)).toBe(1119)
    expect(meta.agreement_number).toBe(number)
    expect(meta.braname).toBe(KRG)
    expect(amount(meta.amount)).toBeCloseTo(SUM, 4)
    expect(String(meta.invest_hash)).toMatch(/^[0-9a-f]{64}$/)
  })

  it(caseName('mkt.order.invest.istok.03', 'вложение деньгами и имуществом: фаза участка и строки инициатора; предпросмотр равен формуле контракта'), async () => {
    await ensureAgreement(chairkrg)
    await ensureShareFunds(chairkrg.account, SUM, krgToken)
    const before = (await gql<any>(krgToken, BRANCH_INVESTMENT, { b: KRG })).marketplaceBranchInvestment
    const mineBefore = investorOf(before, chairkrg.account)

    const afterMoney = await investMoney(chairkrg, KRG, SUM)
    expect(afterMoney.phase, 'после вложения деньгами вложения у участка есть').not.toBe('NONE')
    const viewMoney = (await gql<any>(krgToken, BRANCH_INVESTMENT, { b: KRG })).marketplaceBranchInvestment
    const mineMoney = investorOf(viewMoney, chairkrg.account)
    expect(amount(mineMoney.money) - amount(mineBefore?.money ?? 0), 'внесено деньгами — ровно сумма').toBeCloseTo(SUM, 4)
    expect(amount(viewMoney.money_total) - amount(before.money_total)).toBeCloseTo(SUM, 4)

    // История вложений: запись о деньгах с хэшем процесса из заявления (istok.09).
    const page = (await gql<any>(krgToken, MY_HISTORY, { o: { page: 1, limit: 20, sortOrder: 'DESC' } })).marketplaceMyInvestHistory
    const entry = (page.items as any[]).find(i => i.process_hash === String(afterMoney.investHash).toLowerCase())
    expect(entry?.kind, 'вложение деньгами в истории').toBe('MONEY')
    expect(amount(entry.amount)).toBeCloseTo(SUM, 4)

    await investPropertyAccepted({ investor: chairkrg, chairman: chairkrg, braname: KRG, sum: PROPERTY_SUM, name: `Холодильная витрина ${Date.now().toString(36)}` })
    const view = (await gql<any>(krgToken, BRANCH_INVESTMENT, { b: KRG })).marketplaceBranchInvestment
    const mine = investorOf(view, chairkrg.account)
    expect(amount(mine.property) - amount(mineBefore?.property ?? 0), 'имущество по цене приёма').toBeCloseTo(PROPERTY_SUM, 4)
    expect(['FUNDING', 'RETURNING'], 'имущество сразу в базе возврата').toContain(view.phase)
    expect(amount(view.outstanding), 'к возврату не меньше принятого имущества').toBeGreaterThanOrEqual(PROPERTY_SUM)

    // Предпросмотр узла — формула контракта на строках цепи.
    const { branch, investor } = await chainInvestment(KRG, chairkrg.account)
    const mineList = (await gql<any>(krgToken, MY_INVESTMENTS)).marketplaceMyInvestments.find((i: any) => i.braname === KRG)
    expect(unitsOf(mineList.claimable)).toBe(contractClaimable(branch, investor))
  }, 600_000)

  it(caseName('mkt.order.invest.istok.04', 'вносит только оператор своего участка: пайщику без роли и председателю чужого участка — отказ, строки участка не меняются'), async () => {
    const before = (await gql<any>(krgToken, BRANCH_INVESTMENT, { b: KRG })).marketplaceBranchInvestment
    // Пайщик без роли оператора: вложения ему недоступны с договора — отказ правом.
    const agreement = await refusal(outsiderToken, 'query{ marketplaceInvestAgreementSignablePayload{ hash } }')
    expect(agreement?.codeText ?? '', 'договор участия — только операторам участка').toMatch(/KIT_INSUFFICIENT_RIGHTS/)
    // Председатель участка odn вносит в участок krg: участок не его — отказ до цепи.
    const foreign = await refusal(await tokenOf(chairodn), INVEST_MONEY, {
      d: { braname: KRG, amount: SUM, invest_hash: 'a'.repeat(64), statement: { hash: 'a'.repeat(64), doc_hash: 'a'.repeat(64), meta_hash: 'a'.repeat(64), meta: {}, signatures: [], version: '1' } },
    })
    expect(foreign, 'чужой участок').toBeTruthy()
    const after = (await gql<any>(krgToken, BRANCH_INVESTMENT, { b: KRG })).marketplaceBranchInvestment
    expect(investorOf(after, outsider.account)).toBeUndefined()
    expect(investorOf(after, chairodn.account)).toBeUndefined()
    expect(amount(after.money_total)).toBeCloseTo(amount(before.money_total), 4)
  })
})
