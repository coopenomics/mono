/**
 * Контрактный уровень: денежное место списания скоропорта Стола заказов
 * (задача 598-51; реестр marketplace.writeoff, level contract).
 *
 * Имущество физически выбывает со склада только двумя подписями и решением
 * совета между ними:
 *
 *   1) председатель собирает черновик из кандидатов на списание и подписывает
 *      Заявление о списании — проект уходит на повестку совета (propwroff);
 *   2) совет авторизует проект (onmktwoauth) — это ещё НЕ выбытие: совет лишь
 *      признаёт списание допустимым;
 *   3) председатель кооперативного участка подписывает Служебную записку —
 *      только тогда идёт проводка o.mkt.wroff (Дт 86 / Кт 10), и только по
 *      позициям СВОЕГО участка.
 *
 * Проверяется именно третий шаг: что до записки денег не двигают, что проводка
 * ложится Дт 86 / Кт 10 на сумму позиции, идёт ниткой списания по хэшу проекта
 * и разрезом — по участку, а не по пайщику.
 *
 * Тест берёт МАЛУЮ часть доступного кандидата (одну единицу), чтобы не съедать
 * остаток склада, на котором работают сценарии сюиты docs-harness.
 *
 * Требует стенда после `reboot:extra` (расширенный совет из пяти человек — без
 * него решение не набирает большинства) и наличия хотя бы одного кандидата на
 * списание на КУ «krg».
 */
import { beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { processLastDecision } from './soviet/processLastDecision'
import {
  ACC,
  CHAIRMAN,
  amount,
  applyOpsOfProcess,
  fromState,
  gqlAs,
  historyOfProcess,
  loginAs,
  processTypeByOperation,
  signAs,
  sumOf,
  waitForOps,
} from './marketplace/chainHelpers'

const COOP = 'voskhod'
const BRANAME = 'krg'

const chairkrg = fromState('chairkrg')
const bc = new Blockchain(config.network, config.private_keys)

let chairmanToken = ''
let chairkrgToken = ''

let draftId = ''
let proposalId = ''
let proposalHash = ''
let writeoffAmount = 0
let candidateTitle = ''

/** Дождаться нужного статуса проекта: авторизация совета доезжает дельтой. */
async function waitForProposalStatus(token: string, id: string, wanted: string[], timeoutMs = 120_000) {
  const q = `query($id:String!){
    marketplaceWriteoffProposal(id:$id){ id status proposal_hash total_amount items{ braname amount quantity executed asset_title } }
  }`
  const deadline = Date.now() + timeoutMs
  let last: any = null
  while (Date.now() < deadline) {
    const d: any = await gqlAs(token, q, { id }).catch(() => null)
    last = d?.marketplaceWriteoffProposal ?? last
    if (last && wanted.includes(last.status)) return last
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error(`проект списания ${id} не дошёл до [${wanted.join('|')}] за ${timeoutMs} мс; последний статус: ${last?.status}`)
}

describe('Стол заказов — денежное место списания скоропорта (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    chairmanToken = await loginAs(CHAIRMAN)
    chairkrgToken = await loginAs(chairkrg)
  }, 120_000)

  it('черновик списания собирается из кандидатов склада участка', async () => {
    const d: any = await gqlAs(chairmanToken, `query{
      marketplaceListWriteoffCandidates{ key braname asset_title quantity amount is_expired lots_count inventory_ids }
    }`)
    const candidates = (d.marketplaceListWriteoffCandidates as any[]).filter(c => c.braname === BRANAME)
    expect(candidates.length,
      `на складе КУ «${BRANAME}» нет кандидатов на списание — случай не проверяем на пустом складе`,
    ).toBeGreaterThan(0)

    const c = candidates[0]
    candidateTitle = c.asset_title
    // Берём ровно одну единицу и один лот: остальное оставляем сценариям сюиты.
    const unitPrice = amount(c.amount) / Number.parseFloat(c.quantity)
    writeoffAmount = unitPrice
    const inventoryIds = (c.inventory_ids ?? []).slice(0, 1)

    const cr: any = await gqlAs(chairmanToken, `mutation($d:MarketplaceCreateWriteoffDraftInput!){
      marketplaceCreateWriteoffDraft(data:$d){ id status total_amount items{ braname asset_title quantity amount reason } }
    }`, {
      d: {
        items: [{
          braname: BRANAME,
          asset_title: candidateTitle,
          quantity: '1',
          amount: writeoffAmount.toFixed(4),
          reason: 'Контрактный тест денежных мест: утилизация скоропорта.',
          inventory_ids: inventoryIds.length ? inventoryIds : null,
        }],
      },
    })
    const draft = cr.marketplaceCreateWriteoffDraft
    draftId = draft.id
    expect(draft.status, 'свежесобранный проект — черновик').toBe('DRAFT')
    expect(amount(draft.total_amount)).toBeCloseTo(writeoffAmount, 2)
  }, 180_000)

  it('подписанное заявление выносит проект на повестку совета, но имущество ещё на балансе', async () => {
    const pl: any = await gqlAs(chairmanToken, `query($d:MarketplaceWriteoffStatementSignablePayloadInput!){
      marketplaceWriteoffStatementSignablePayload(data:$d){ full_title html hash meta binary }
    }`, { d: { draft_id: draftId } })
    const signed = await signAs(CHAIRMAN.wif, pl.marketplaceWriteoffStatementSignablePayload, CHAIRMAN.account, 1)

    const sub: any = await gqlAs(chairmanToken, `mutation($d:MarketplaceSubmitWriteoffDraftInput!){
      marketplaceSubmitWriteoffDraft(data:$d){ id status proposal_hash total_amount }
    }`, { d: { draft_id: draftId, signed_statement: signed } })
    const proposal = sub.marketplaceSubmitWriteoffDraft
    proposalId = proposal.id
    proposalHash = proposal.proposal_hash

    expect(proposalHash, 'у проекта списания обязан быть собственный хэш нитки').toBeTruthy()
    expect(proposal.status, 'после подписи заявления проект уходит на повестку, а не исполняется').toBe('ON_AGENDA')

    // Ключевое: вынесение на повестку деньги НЕ двигает.
    const ops = await applyOpsOfProcess(chairmanToken, proposalHash)
    expect(ops.filter(o => o.operationCode === 'o.mkt.wroff').length,
      'до подписи Служебной записки председателем участка имущество обязано оставаться на балансе').toBe(0)
  }, 180_000)

  it('авторизация совета сама по себе тоже не списывает — она лишь признаёт списание допустимым', async () => {
    await processLastDecision(bc, COOP)
    const p = await waitForProposalStatus(chairmanToken, proposalId, ['AUTHORIZED', 'PENDING_CONFIRMATION'])
    expect(['AUTHORIZED', 'PENDING_CONFIRMATION']).toContain(p.status)

    const ops = await applyOpsOfProcess(chairmanToken, proposalHash)
    expect(ops.filter(o => o.operationCode === 'o.mkt.wroff').length,
      'решение совета — разрешение, а не выбытие: проводки на этом шаге быть не должно').toBe(0)
  }, 300_000)

  it('Служебная записка председателя участка списывает имущество: o.mkt.wroff, Дт 86 / Кт 10', async () => {
    const pl: any = await gqlAs(chairkrgToken, `query($d:MarketplaceWriteoffServiceMemoSignablePayloadInput!){
      marketplaceWriteoffServiceMemoSignablePayload(data:$d){ full_title html hash meta binary }
    }`, { d: { braname: BRANAME, proposal_id: proposalId } })
    const memo = await signAs(chairkrg.wif, pl.marketplaceWriteoffServiceMemoSignablePayload, chairkrg.account, 1)

    await gqlAs(chairkrgToken, `mutation($d:MarketplaceConfirmWriteoffInput!){
      marketplaceConfirmWriteoff(data:$d){ id status }
    }`, { d: { braname: BRANAME, proposal_id: proposalId, signed_memo: memo } })

    const ops = await waitForOps(chairmanToken, proposalHash, ['o.mkt.wroff'])
    expect(sumOf(ops, 'o.mkt.wroff'), 'списывается ровно сумма позиции проекта').toBeCloseTo(writeoffAmount, 2)

    const wroff = ops.find(o => o.operationCode === 'o.mkt.wroff')!
    expect(wroff.username,
      'разрез списания — кооперативный участок, чей это склад, а не пайщик').toBe(BRANAME)

    const rows = await historyOfProcess(chairmanToken, proposalHash)
    const debited = rows.filter(r => r.action === 'debit' && r.accountId === ACC.TARGET
      && Math.abs(amount(r.quantity) - writeoffAmount) < 0.005)
    const credited = rows.filter(r => r.action === 'credit' && r.accountId === ACC.MATERIALS
      && Math.abs(amount(r.quantity) - writeoffAmount) < 0.005)
    expect(debited.length, 'списание обязано лечь Дт 86 — закрывается целевое финансирование').toBeGreaterThan(0)
    expect(credited.length, 'списание обязано лечь Кт 10 — имущество выбывает со склада').toBeGreaterThan(0)

    // Кошельки при утилизации не двигаются: выбывает имущество, а не деньги.
    const walletMoves = rows.filter(r => r.action === 'walletop')
    expect(walletMoves.length,
      'утилизация — чисто бухгалтерское выбытие, кошельковых движений быть не должно').toBe(0)
  }, 300_000)

  it('списание идёт собственной ниткой процесса утилизации', async () => {
    const byOp = await processTypeByOperation(chairmanToken, proposalHash)
    expect(byOp['o.mkt.wroff'], 'у утилизации своя нитка, отдельная от поставки').toBe('p.mkt.wroff')

    const d: any = await gqlAs(chairmanToken, 'query($h:String!,$c:String!){ process(hash:$h, coopname:$c){ process_type } }', {
      h: proposalHash.toLowerCase(), c: COOP,
    })
    expect(d.process.process_type).toBe('p.mkt.wroff')
  }, 180_000)
})
