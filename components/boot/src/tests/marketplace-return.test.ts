/**
 * Контрактный уровень: денежные места гарантийного возврата Стола заказов
 * (задача 598-51; реестр marketplace.return, level contract; плюс
 * ledger2.process-naming l2.pnam.side.02).
 *
 * Приём имущества у стойки (`accretrn`) ставит заявление на повестку совета;
 * решение совета (`onmktrtauth`) — это ТРИ ноги в одной
 * транзакции, и все три обязаны идти НИТКОЙ ВОЗВРАТА по хэшу заявки, а не
 * ниткой исходной поставки:
 *
 *   • o.mkt.return  — восстановление паевого взноса и имущества (Дт 10 / Кт 80,
 *                     ISSUE на членский «Стола заказов» заказчицы);
 *   • o.brn.retfee  — общий кошелёк участка → пул взносов «Стола заказов»
 *                     (инверсия зачисления, без бухпроводки);
 *   • o.mkt.refund  — пул взносов → свободный паевой «Стола заказов» заказчицы.
 *
 * Двухходовка через пул нужна из-за инварианта walletop «один username на обе
 * стороны»: прямой перевод с кошелька участка на кошелёк пайщика невозможен.
 * Пайщику возвращается ПОЛНАЯ уплаченная сумма — стоимость имущества плюс
 * приходящийся на него членский взнос.
 *
 * Возврат — compensating forward, а не откат: исходная o.mkt.consum в журнале
 * не трогается, поэтому нитка поставки после возврата обязана остаться прежней.
 *
 * Тест самодостаточен: ведёт свой заказ от корзины до получения, затем
 * возвращает его целиком. Требует стенда с сид-фазами docs-harness.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { processDecision } from './soviet/processDecision'
import {
  ACC,
  CHAIRMAN,
  type LedgerRow,
  amount,
  applyOpsOfProcess,
  ensureShareFunds,
  fromState,
  gqlAs,
  historyOfProcess,
  loginAs,
  opsCodes,
  processTypeByOperation,
  signAs,
  sumOf,
  waitForOps,
} from './marketplace/chainHelpers'
import { acceptToCoop, issueOrder, pickOffer, placeOrder } from './marketplace/orderFlow'

const bc = new Blockchain(config.network, config.private_keys)

const BRANAME = 'krg'
const QTY = 2 // заказано и выдано целиком — возвращаем весь заказ

/** Минимальный валидный PNG 1×1: фото осмотра обязательны по форме заявления. */
const PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const PHOTO = { base64: PIXEL_PNG, mime_type: 'image/png' }

const sidorov = fromState('sidorov')
const ekaterina = fromState('ekaterina')
const chairkrg = fromState('chairkrg')

let chairmanToken = ''
let sidorovToken = ''
let ekaterinaToken = ''
let chairkrgToken = ''

let unitPrice = 0
let orderId = ''
let orderHash = ''
let claimId = ''
let requestHash = ''
let factCost = 0
let feeRefund = 0
let totalRefund = 0
let consumBefore = 0

let ops: LedgerRow[] = []

function postingsFor(rows: LedgerRow[], action: 'debit' | 'credit', accountId: number, value: number) {
  return rows.filter(r => r.action === action && r.accountId === accountId && Math.abs(amount(r.quantity) - value) < 0.005)
}

describe('стол заказов — денежные места гарантийного возврата (contract, живая цепь)', () => {
  beforeAll(async () => {
    chairmanToken = await loginAs(CHAIRMAN)
    sidorovToken = await loginAs(sidorov)
    ekaterinaToken = await loginAs(ekaterina)
    chairkrgToken = await loginAs(chairkrg)

    const offer = await pickOffer(chairmanToken, sidorov.account, BRANAME, 'Мёд цветочный')
    unitPrice = amount(offer.price_per_unit)

    // См. комментарий в marketplace-money: фикстуру дозаправляем сами, иначе
    // повторяемость теста упирается в остаток из сида.
    await ensureShareFunds(ekaterina.account, QTY * unitPrice * 2)

    const placed = await placeOrder({
      token: ekaterinaToken,
      who: ekaterina,
      offerId: offer.id,
      quantity: QTY,
      braname: BRANAME,
    })
    orderId = placed.orderId
    orderHash = placed.orderHash

    await acceptToCoop({
      supplierToken: sidorovToken,
      supplier: sidorov,
      operatorToken: chairkrgToken,
      operator: chairkrg,
      orderId,
      braname: BRANAME,
      factQuantity: QTY,
      factUnitPrice: unitPrice,
    })
    await waitForOps(chairmanToken, orderHash, ['o.mkt.purch'])

    await issueOrder({
      blockchain: bc,
      operatorToken: chairkrgToken,
      operator: chairkrg,
      memberToken: ekaterinaToken,
      member: ekaterina,
      orderId,
      braname: BRANAME,
      actualQuantity: QTY,
      actualUnitPrice: unitPrice,
    })
    const supply = await waitForOps(chairmanToken, orderHash, ['o.mkt.consum', 'o.brn.common'])
    consumBefore = sumOf(supply, 'o.mkt.consum')
    expect(consumBefore, 'заказ обязан быть выдан целиком до возврата').toBeCloseTo(QTY * unitPrice, 2)
  }, 600_000)

  it('заявление на возврат подаётся пайщицей и фиксирует суммы к возврату (submretrn)', async () => {
    const pl: any = await gqlAs(ekaterinaToken, `query($d:MarketplaceReturnClaimSignablePayloadInput!){
      marketplaceReturnClaimSignablePayload(data:$d){ full_title html hash meta binary }
    }`, { d: { order_id: orderId, actual_quantity: QTY, reason_text: 'Контрактный тест денежных мест: возврат по гарантии.' } })
    const signed = await signAs(ekaterina.wif, pl.marketplaceReturnClaimSignablePayload, ekaterina.account, 1)

    const cr: any = await gqlAs(ekaterinaToken, `mutation($d:MarketplaceCreateReturnClaimInput!){
      marketplaceCreateReturnClaim(data:$d){
        tx_hash
        claim { id status request_hash order_hash fact_cost fee_refund total_refund submretrn_tx_hash }
      }
    }`, {
      d: {
        order_id: orderId,
        actual_quantity: QTY,
        reason_text: 'Контрактный тест денежных мест: возврат по гарантии.',
        photos: [PHOTO],
        signed_statement: signed,
      },
    })
    const claim = cr.marketplaceCreateReturnClaim.claim
    claimId = claim.id
    requestHash = claim.request_hash
    factCost = amount(claim.fact_cost)
    feeRefund = amount(claim.fee_refund)
    totalRefund = amount(claim.total_refund)

    expect(claim.submretrn_tx_hash, 'подача заявления обязана уйти на цепь').toBeTruthy()
    expect(requestHash, 'у заявки на возврат обязан быть собственный хэш нитки').toBeTruthy()
    expect(requestHash.toLowerCase(), 'нитка возврата обязана отличаться от нитки поставки').not.toBe(orderHash.toLowerCase())

    // Возвращается полная уплаченная сумма: стоимость имущества плюс взнос.
    expect(factCost, 'к возврату заявлена стоимость возвращаемого имущества').toBeCloseTo(QTY * unitPrice, 2)
    expect(totalRefund, 'полный возврат — имущество плюс приходящийся на него членский взнос').toBeCloseTo(factCost + feeRefund, 2)
    expect(feeRefund, 'при полном возврате заказа возвращается и весь взнос по нему').toBeGreaterThan(0)
  }, 300_000)

  it('решение совета по принятому имуществу проводит три ноги: o.mkt.return + o.brn.retfee + o.mkt.refund', async () => {
    await gqlAs(chairkrgToken, `mutation($d:MarketplaceApproveReturnVisitInput!){
      marketplaceApproveReturnVisit(data:$d){ claim { id status } }
    }`, { d: { claim_id: claimId, braname: BRANAME, comment: 'Приглашение на очный осмотр (контрактный тест).' } })

    // Приём имущества — две подписи оператора: своё заявление в совет об отмене
    // сделки (1116), собранное бэкендом по рекламации пайщицы (1106), заказу и
    // результату осмотра, и вторая подпись на самой рекламации — с двумя
    // подписями она уйдёт поставщику как претензия. С заявлением контракт
    // ставит вопрос на повестку совета. Денег на этом шаге нет.
    const inspection = 'Дефект подтверждён на очном осмотре (контрактный тест).'
    const cp: any = await gqlAs(chairkrgToken, `query($c:String!,$r:String!){
      marketplaceReturnClaimChairmanSignablePayload(claim_id:$c, inspection_result:$r){
        cancel_statement{ full_title html hash meta binary }
        reclamation{
          hash
          rawDocument{ full_title html hash meta binary }
          document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }
        }
      }
    }`, { c: claimId, r: inspection })
    const docs = cp.marketplaceReturnClaimChairmanSignablePayload
    const cancelStatement = docs.cancel_statement
    expect(cancelStatement.meta.registry_id, 'у стойки подписывается заявление об отмене сделки').toBe(1116)
    expect(cancelStatement.meta.orderer, 'в заявлении оператора указана пайщица, чья сделка отменяется').toBe(ekaterina.account)
    expect(amount(cancelStatement.meta.fee_refund), 'заявление несёт членский взнос к восстановлению').toBeCloseTo(feeRefund, 2)
    expect(docs.reclamation.document.meta.registry_id ?? docs.reclamation.rawDocument.meta.registry_id, 'под вторую подпись идёт рекламация пайщицы').toBe(1106)
    const signedCancel = await signAs(chairkrg.wif, cancelStatement, chairkrg.account, 1)
    const signedReclamation = await signAs(chairkrg.wif, docs.reclamation.rawDocument, chairkrg.account, 2, [docs.reclamation.document])

    const acc: any = await gqlAs(chairkrgToken, `mutation($d:MarketplaceAcceptReturnAtVisitInput!){
      marketplaceAcceptReturnAtVisit(data:$d){ tx_hash claim { id status council_decision_id council_decision_mode } }
    }`, {
      d: {
        claim_id: claimId,
        braname: BRANAME,
        inspection_result: inspection,
        inspection_photos: [PHOTO],
        signed_statement: signedCancel,
        signed_reclamation: signedReclamation,
      },
    })
    const accepted = acc.marketplaceAcceptReturnAtVisit.claim
    expect(accepted.status, 'после приёма имущества заявление ждёт решение совета').toBe('PENDING_COUNCIL')
    // Робота на стенде нет — решение принимают люди: до него движений по средствам нет.
    expect(opsCodes(await applyOpsOfProcess(chairmanToken, requestHash)).includes('o.mkt.return'), 'до решения совета паевой взнос не восстанавливается').toBe(false)

    // Номер решения дочитывается из цепи (мутация или сторож) — ждём его.
    let decisionId = Number(accepted.council_decision_id || 0)
    for (let i = 0; i < 20 && !decisionId; i += 1) {
      await new Promise(r => setTimeout(r, 1_500))
      const c: any = await gqlAs(chairkrgToken, 'query($c:String!){ marketplaceReturnClaim(claim_id:$c){ council_decision_id } }', { c: claimId })
      decisionId = Number(c.marketplaceReturnClaim.council_decision_id || 0)
    }
    expect(decisionId, 'заявление обязано попасть на повестку совета').toBeGreaterThan(0)
    await processDecision(bc, decisionId).catch((e: any) => {
      console.warn(`processDecision(${decisionId}) отбит: ${e?.message ?? e} — возможно, решение уже принял робот`)
    })

    ops = await waitForOps(chairmanToken, requestHash, ['o.mkt.return', 'o.brn.retfee', 'o.mkt.refund'])

    // Нога 1 — имущество и средства возвращаются заказчице.
    expect(sumOf(ops, 'o.mkt.return'), 'возврат обязан восстановить стоимость возвращённого имущества').toBeCloseTo(factCost, 2)
    const returned = ops.find(r => r.operationCode === 'o.mkt.return')!
    expect(returned.username, 'средства восстанавливаются заказчице').toBe(ekaterina.account)

    // Ноги 2 и 3 — взнос идёт обратно тем же путём, что уходил: участок → пул → пайщица.
    expect(sumOf(ops, 'o.brn.retfee'), 'участок обязан вернуть в пул взносов приходящуюся на возврат долю').toBeCloseTo(feeRefund, 2)
    expect(sumOf(ops, 'o.mkt.refund'), 'из пула взносов доля обязана дойти до свободного паевого заказчицы').toBeCloseTo(feeRefund, 2)

    const fromBranch = ops.find(r => r.operationCode === 'o.brn.retfee')!
    expect(fromBranch.username, 'разрез ноги возврата взноса — имя участка').toBe(BRANAME)

    // Итог по пайщице — ровно та сумма, что заявлена к возврату.
    expect(sumOf(ops, 'o.mkt.return') + sumOf(ops, 'o.mkt.refund'), 'заказчице обязана вернуться полная уплаченная сумма').toBeCloseTo(totalRefund, 2)
  }, 300_000)

  it('возврат ложится Дт 10 / Кт 80, а транзит взноса возвращает членский взнос в паевой', async () => {
    const rows = await historyOfProcess(chairmanToken, requestHash)

    expect(postingsFor(rows, 'debit', ACC.MATERIALS, factCost).length, 'возвращённое имущество обязано лечь Дт 10 — оно снова на складе').toBeGreaterThan(0)
    expect(postingsFor(rows, 'credit', ACC.SHARE, factCost).length, 'паевой взнос пайщицы обязан восстановиться Кт 80').toBeGreaterThan(0)

    // Транзит взноса: участок → пул без проводок (внутри 86), пул → свободный
    // паевой пайщицы с проводкой Дт 86 / Кт 80 — членский взнос возвращается в паевой.
    const feeMoves = rows.filter(r => r.action === 'walletop'
      && ((r.walletFrom === 'w.brn.common' && r.walletTo === 'w.mkt.fee')
        || (r.walletFrom === 'w.mkt.fee' && r.walletTo === 'w.mkt.share')))
    expect(feeMoves.length, 'взнос обязан пройти двумя кошельковыми ходами: участок → пул → пайщица').toBe(2)
    for (const m of feeMoves) expect(amount(m.quantity)).toBeCloseTo(feeRefund, 2)

    expect(postingsFor(rows, 'debit', ACC.TARGET, feeRefund).length, 'возврат членского взноса обязан лечь Дт 86').toBeGreaterThan(0)
    expect(postingsFor(rows, 'credit', ACC.SHARE, feeRefund).length, 'возврат членского взноса обязан лечь Кт 80').toBeGreaterThan(0)
  }, 300_000)

  it('l2.pnam.side.02: обе ноги возврата взноса идут ниткой ГАРАНТИЙНОГО ВОЗВРАТА по хэшу заявки', async () => {
    const byOp = await processTypeByOperation(chairmanToken, requestHash)

    expect(byOp['o.brn.retfee'], 'инверсия зачисления обязана называть нитку именем контракта-источника — гарантийный возврат').toBe('p.mkt.return')

    // o.mkt.refund в реестре операций объявлен под ПОСТАВКОЙ (там он возвращает
    // неиспользованный взнос по заказу), но здесь он вторая нога возврата —
    // нитку называет её инициатор, а не реестр кода операции.
    expect(byOp['o.mkt.refund'], 'имя нитки называет инициатор, а не реестр операции: тот же код в возврате идёт ниткой возврата').toBe('p.mkt.return')

    expect(byOp['o.mkt.return'], 'основная нога возврата идёт своей же ниткой').toBe('p.mkt.return')

    const d: any = await gqlAs(chairmanToken, 'query($h:String!,$c:String!){ process(hash:$h, coopname:$c){ process_type } }', {
      h: requestHash.toLowerCase(),
      c: 'voskhod',
    })
    expect(d.process.process_type, 'у хэша заявки на возврат одно имя нитки').toBe('p.mkt.return')
  }, 300_000)

  it('l2.pnam.side.13: обоснование проводки длиннее 255 байт проходит и сохраняется целиком', async () => {
    // Обоснования пишутся человеческим языком, а кириллица занимает по два
    // байта на символ — любой предел по длине отсекал бы осмысленные
    // формулировки, поэтому ledger2 длину memo не ограничивает. Самое длинное
    // обоснование канона — нога возврата взноса: она называет и заявление, и
    // исходный заказ, и обе стороны транзита.
    const rows = await historyOfProcess(chairmanToken, requestHash)
    const retfee = rows.find(r => r.action === 'apply' && r.operationCode === 'o.brn.retfee')
    expect(retfee, 'нога возврата взноса обязана быть в нитке').toBeTruthy()

    const memo = retfee!.memo ?? ''
    const bytes = Buffer.byteLength(memo, 'utf8')
    expect(bytes, 'обоснование этой проводки штатно длиннее 255 байт — иначе случай не проверяем').toBeGreaterThan(255)

    // Целиком — значит без обрезки ни в цепи, ни в parser2, ни в журнале
    // контроллера: текст обязан быть законченным предложением, а не оборванным
    // на границе буфера.
    expect(memo.endsWith('…'), 'memo не должно приходить обрезанным многоточием').toBe(false)
    expect(memo, `обоснование обязано доезжать целиком, пришло ${bytes} байт: «${memo}»`)
      .toMatch(/из общего кошелька кооперативного участка$/)

    // И длина не режется по границе байта: строка обязана быть валидным UTF-8
    // без «хвоста» — round-trip через Buffer совпадает с исходной.
    expect(Buffer.from(memo, 'utf8').toString('utf8')).toBe(memo)
  }, 300_000)

  it('99D-13: по решению совета поставщику выставлена претензия (не признана), согласие кладёт сумму в долг к удержанию', async () => {
    // Хэш претензии выводится из хэша рекламации: sha256(байты хэша ‖ "claim").
    const { createHash } = await import('node:crypto')
    const claimHash = createHash('sha256')
      .update(Buffer.concat([Buffer.from(requestHash, 'hex'), Buffer.from('claim', 'utf8')]))
      .digest('hex')
    const issued = await waitForOps(chairmanToken, claimHash, ['o.mkt.claim'])
    expect(sumOf(issued, 'o.mkt.claim'), 'претензия выставлена на стоимость возвращённого имущества').toBeCloseTo(factCost, 2)
    expect(issued.find(r => r.operationCode === 'o.mkt.claim')!.username, 'претензия висит на поставщике').toBe(sidorov.account)

    // Поставщик видит претензию у себя: рекламация с двумя подписями, сумма, состояние.
    let list: any = null
    for (let i = 0; i < 20 && !list?.length; i += 1) {
      const r: any = await gqlAs(sidorovToken, `query{ marketplaceListSupplierClaims { id claim_hash status amount supplier_account } }`)
      list = r.marketplaceListSupplierClaims.filter((c: any) => c.claim_hash.toLowerCase() === claimHash.toLowerCase())
      if (!list.length) await new Promise(res => setTimeout(res, 1_500))
    }
    expect(list?.length, 'претензия обязана появиться на столе поставщика').toBe(1)
    const claim = list[0]
    expect(claim.status).toBe('PENDING')
    expect(amount(claim.amount)).toBeCloseTo(factCost, 2)

    const one: any = await gqlAs(sidorovToken, `query($c:String!){ marketplaceSupplierClaim(claim_id:$c){ id reclamation{ hash document{ signatures{ signer } } } } }`, { c: claim.id })
    const signers = (one.marketplaceSupplierClaim.reclamation?.document?.signatures ?? []).map((x: any) => x.signer)
    expect(signers, 'рекламация поставщику — с подписями пайщицы и оператора').toEqual(expect.arrayContaining([ekaterina.account, chairkrg.account]))

    // Поставщик соглашается: сумма уходит с кошелька непризнанных в признанный долг (o.mkt.admit, Дт 76 / Кт 91).
    const adm: any = await gqlAs(sidorovToken, `mutation($d:MarketplaceAdmitSupplierClaimInput!){ marketplaceAdmitSupplierClaim(data:$d){ tx_hash claim { status } } }`, { d: { claim_id: claim.id } })
    expect(adm.marketplaceAdmitSupplierClaim.claim.status).toBe('ADMITTED')
    const admitted = await waitForOps(chairmanToken, claimHash, ['o.mkt.admit'])
    expect(sumOf(admitted, 'o.mkt.admit')).toBeCloseTo(factCost, 2)

    const rows = await historyOfProcess(chairmanToken, claimHash)
    const postings = rows.filter(r => r.action === 'apply' && r.operationCode === 'o.mkt.admit')
    void postings

    const sum: any = await gqlAs(sidorovToken, `query{ marketplaceSupplierClaimSummary { admitted_debt not_admitted_total } }`)
    expect(amount(sum.marketplaceSupplierClaimSummary.admitted_debt), 'сводка признанного долга равна сумме претензии').toBeCloseTo(factCost, 2)
    expect(amount(sum.marketplaceSupplierClaimSummary.not_admitted_total), 'после согласия непризнанного по этой претензии не осталось').toBeCloseTo(0, 2)
  }, 300_000)

  it('возврат — compensating forward: нитка исходной поставки не переписывается', async () => {
    const supply = await applyOpsOfProcess(chairmanToken, orderHash)

    expect(sumOf(supply, 'o.mkt.consum'), 'исходное выбытие обязано остаться в журнале нетронутым').toBeCloseTo(consumBefore, 2)

    const supplyCodes = new Set(opsCodes(supply))
    expect(supplyCodes.has('o.mkt.return'), 'проводка возврата не должна попадать в нитку поставки — у возврата своя нитка').toBe(false)
    expect(supplyCodes.has('o.brn.retfee'), 'нога возврата взноса не должна попадать в нитку поставки').toBe(false)
  }, 300_000)
})
