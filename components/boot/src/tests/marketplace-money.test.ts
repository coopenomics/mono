/**
 * Контрактный уровень: денежные места Стола заказов — поставка и выдача
 * (задача 598-51; реестр marketplace.supply / marketplace.issuance, level
 * contract; плюс ledger2.process-naming l2.pnam.side.01).
 *
 * Тест ведёт ОДИН заказ через всю цепочку живой цепи тем же путём, которым
 * ходит desktop — корзина → оформление → акцепт поставщиком → экспресс-приёмка
 * на ПВЗ → бандл выдачи, — и ассертит нитку ledger2 по хэшу заказа:
 *
 *   • o.mkt.lock   — оформление резервирует паевой взнос под заказ (без проводки: паевой остаётся на 80);
 *   • o.mkt.conv   — недостающая до членского взноса часть конвертируется из
 *                    паевого в членский кошелёк программы по заявлению 1110;
 *   • o.mkt.fee    — членский взнос по ставке кооператива уходит с членского
 *                    кошелька в пул взносов под заказ;
 *   • o.mkt.purch  — закрывающая подпись приёмки ставит имущество на баланс (Дт 10 / Кт 60)
 *                    по ЦЕНЕ ПРИБЫТИЯ (Дт 10 / Кт 86), а не по цене заказа;
 *   • o.mkt.consum — выдача списывает выданное по цене прибытия (Дт 80 / Кт 10);
 *   • o.mkt.unlock — недовыдача разблокирует невыданный остаток заказчицы;
 *   • o.mkt.refund — неиспользованная часть взноса возвращается пропорционально;
 *   • o.brn.common — фактический взнос зачисляется общему кошельку участка,
 *                    причём НИТКОЙ ПОСТАВКИ по хэшу заказа (l2.pnam.side.01),
 *                    а не ниткой экономики участка.
 *
 * Суммы не захардкожены: эталон берётся из самого заказа (`total_cost`,
 * `membership_fee`), поэтому тест не ломается от смены ставки взноса или
 * прайса предложения. Захардкожена только арифметика инварианта —
 * пропорция факта к заказу.
 *
 * Заказ создаётся свежий на каждом прогоне, поэтому тест повторяем; состояние
 * сюиты docs-harness не переписывается — используется её же сид (предложения
 * sidorov на КУ «krg» и подключённые участники).
 *
 * Требует стенда после `reboot:extra` с сид-фазами docs-harness.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { issueOrder } from './marketplace/orderFlow'
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
  waitForOrderMirror,
} from './marketplace/chainHelpers'

const bc = new Blockchain(config.network, config.private_keys)

const BRANAME = 'krg'
const ORDER_QTY = 4 // заказано единиц
const ISSUED_QTY = 3 // выдано единиц; одна единица — недовыдача

const sidorov = fromState('sidorov')
const ekaterina = fromState('ekaterina')
const chairkrg = fromState('chairkrg')

let chairmanToken = ''
let sidorovToken = ''
let ekaterinaToken = ''
let chairkrgToken = ''

let offer: any
let unitPrice = 0
let orderId = ''
let orderHash = ''
let totalCost = 0
let membershipFee = 0
/** Недостающая до взноса часть, которую превью велело конвертировать по заявлению 1110. */
let expectedConvert = 0

/** Проводки нитки заказа — переиспользуются несколькими ассертами. */
let ops: LedgerRow[] = []

/** Строки debit/credit нитки: по ним ассертится «Дт 10 / Кт 86» и т. п. */
function postingsFor(rows: LedgerRow[], action: 'debit' | 'credit', accountId: number, value: number) {
  return rows.filter(r => r.action === action && r.accountId === accountId && Math.abs(amount(r.quantity) - value) < 0.005)
}

describe('стол заказов — денежные места поставки и выдачи (contract, живая цепь)', () => {
  beforeAll(async () => {
    chairmanToken = await loginAs(CHAIRMAN)
    sidorovToken = await loginAs(sidorov)
    ekaterinaToken = await loginAs(ekaterina)
    chairkrgToken = await loginAs(chairkrg)

    // Берём любое активное предложение фонового поставщика с поставкой на наш
    // КУ: суммы теста считаются от заказа, поэтому конкретный товар не важен —
    // важно лишь, что предложение sidorov'а живое и доставляется на krg.
    const d: any = await gqlAs(chairmanToken, `query($i:MarketplaceListAllOffersInput){
      marketplaceListAllOffers(input:$i){ items {
        id product_name status supplier_account price_per_unit unit_of_measure warranty_days
        delivery_points { braname min_supply_volume }
      } }
    }`, { i: {} })
    const candidates = (d.marketplaceListAllOffers.items as any[]).filter(
      o => o.status === 'ACTIVE'
        && o.supplier_account === sidorov.account
        && o.delivery_points.some((p: any) => p.braname === BRANAME),
    )
    offer = candidates.find(o => o.product_name === 'Мёд цветочный') ?? candidates[0]
    expect(offer, `на стенде нет активного предложения ${sidorov.account} с поставкой на КУ «${BRANAME}»`).toBeTruthy()
    unitPrice = amount(offer.price_per_unit)

    // Каждый прогон списывает с паевого заказчицы тело заказа и членский взнос.
    // Без дозаправки тест повторяем лишь пока не иссякнет остаток из сида, а
    // потом падает на «Недостаточно средств» — и это выглядит как регресс,
    // хотя это исчерпание фикстуры. Запас — двукратный от тела заказа.
    await ensureShareFunds(ekaterina.account, ORDER_QTY * unitPrice * 2)
  }, 180_000)

  it('оформление заказа резервирует тело (o.mkt.lock), конвертирует недостающий взнос по заявлению (o.mkt.conv) и блокирует членский взнос (o.mkt.fee)', async () => {
    // Корзина может держать хвост прошлого прогона — начинаем с чистой.
    await gqlAs(ekaterinaToken, 'mutation{ marketplaceClearCart{ __typename } }').catch(() => {})
    await gqlAs(ekaterinaToken, 'mutation($i:MarketplaceAddToCartInput!){ marketplaceAddToCart(input:$i){ __typename } }', {
      i: { offer_id: offer.id, quantity: ORDER_QTY, delivery_braname: BRANAME },
    })

    // Оформление (паевая модель) = превью строк + мутация оформления корзины.
    // По каждой строке пайщица подписывает заявление 1110 о переводе паевого
    // взноса в программу на полную сумму с выделением членского взноса; по
    // кошелькам тело идёт паевыми кошельками, взнос — членскими, и в членский
    // переводится только недостающая до взноса часть.
    const sp: any = await gqlAs(ekaterinaToken, `query{
      marketplaceCheckoutSignablePayloads{ offer_id package_id order_hash amount membership_fee convert_amount document{ full_title html hash meta binary } }
    }`)
    const payloads = sp.marketplaceCheckoutSignablePayloads as any[]
    expect(payloads.length, 'по позиции корзины обязано прийти превью оформления').toBeGreaterThan(0)
    expectedConvert = amount(payloads[0].convert_amount)
    // Заявление приходит по каждой строке: полная сумма = тело + взнос, а
    // переводимая в членский часть не больше взноса (остаток кошелька зачтён).
    expect(payloads[0].document, 'по строке обязано прийти заявление 1110 к подписи').toBeTruthy()
    const stmtMeta = JSON.parse(payloads[0].document.meta)
    expect(amount(stmtMeta.amount), 'в заявлении — полная сумма позиции').toBeCloseTo(amount(payloads[0].amount), 2)
    expect(amount(stmtMeta.membership_fee), 'в заявлении выделен членский взнос участка').toBeCloseTo(amount(payloads[0].membership_fee), 2)
    expect(amount(stmtMeta.convert_amount)).toBeCloseTo(expectedConvert, 2)
    expect(expectedConvert, 'в членский переводится не больше взноса').toBeLessThanOrEqual(amount(payloads[0].membership_fee) + 0.005)

    const lines = await Promise.all(payloads.map(async p => ({
      offer_id: p.offer_id,
      package_id: p.package_id,
      order_hash: p.order_hash,
      signed_statement: p.document ? await signAs(ekaterina.wif, p.document, ekaterina.account, 1) : null,
    })))

    const co: any = await gqlAs(ekaterinaToken, `mutation($i:MarketplaceCheckoutCartInput){
      marketplaceCheckoutCart(input:$i){ fully_completed created_orders{ id status } failed_lines{ reason } }
    }`, { i: { lines } })
    const result = co.marketplaceCheckoutCart
    expect(result.fully_completed, `оформление обязано пройти целиком: ${JSON.stringify(result.failed_lines)}`).toBe(true)
    orderId = result.created_orders[0].id

    // Хэш заказа известен сразу — суммы зеркала доезжают дельтой позже.
    const created: any = await gqlAs(ekaterinaToken, `query($i:MarketplaceGetOrderInput!){
      marketplaceGetOrder(input:$i){ id order_hash }
    }`, { i: { order_id: orderId } })
    orderHash = created.marketplaceGetOrder.order_hash

    ops = await waitForOps(chairmanToken, orderHash, expectedConvert > 0 ? ['o.mkt.lock', 'o.mkt.conv', 'o.mkt.fee'] : ['o.mkt.lock', 'o.mkt.fee'])
    const lockAmount = sumOf(ops, 'o.mkt.lock')
    const feeAmount = sumOf(ops, 'o.mkt.fee')
    // Конвертация по заявлению — ровно на недостающую часть взноса, не больше.
    expect(sumOf(ops, 'o.mkt.conv'), 'конвертируется ровно недостающая до взноса часть из превью').toBeCloseTo(expectedConvert, 2)
    expect(sumOf(ops, 'o.mkt.conv'), 'конвертация не превышает членский взнос').toBeLessThanOrEqual(feeAmount + 0.005)
    const convRows = (await historyOfProcess(chairmanToken, orderHash)).filter(r => r.action === 'walletop' && r.operationCode === 'o.mkt.conv')
    for (const r of convRows) {
      expect([r.walletFrom, r.walletTo], 'конвертация идёт с главного паевого на членский кошелёк программы').toEqual(['w.wal.share', 'w.mkt.member'])
    }
    const feeRows = (await historyOfProcess(chairmanToken, orderHash)).filter(r => r.action === 'walletop' && r.operationCode === 'o.mkt.fee')
    for (const r of feeRows) {
      expect([r.walletFrom, r.walletTo], 'взнос под заказ берётся с членского кошелька программы').toEqual(['w.mkt.member', 'w.mkt.fee'])
    }

    // Зеркало бэкенда обязано сойтись с цепью — иначе пайщик видит в кабинете
    // не ту сумму, которую у него реально заблокировали.
    const order = await waitForOrderMirror(
      ekaterinaToken,
      orderId,
      o => Math.abs(amount(o.total_cost) - lockAmount) < 0.005
        && Math.abs(amount(o.membership_fee) - feeAmount) < 0.005,
    )
    totalCost = amount(order.total_cost)
    membershipFee = amount(order.membership_fee)

    // Эталон тела заказа — количество × цена предложения.
    expect(totalCost, 'тело заказа обязано считаться от цены предложения').toBeCloseTo(ORDER_QTY * unitPrice, 2)
    // Взнос — отдельная сумма СВЕРХ тела: пайщик платит тело + взнос.
    expect(amount(order.total_cost_with_fee)).toBeCloseTo(totalCost + membershipFee, 2)
    expect(membershipFee, 'ставка членского взноса кооператива обязана быть больше нуля, иначе денежное место не проверяемо').toBeGreaterThan(0)

    expect(lockAmount, 'резерв обязан равняться телу заказа').toBeCloseTo(totalCost, 2)
    expect(feeAmount, 'взнос обязан равняться ставке, зафиксированной в заказе').toBeCloseTo(membershipFee, 2)

    const lockRow = ops.find(r => r.operationCode === 'o.mkt.lock')!
    expect(lockRow.username, 'резерв ставится на заказчицу').toBe(ekaterina.account)

    // Паевой резерв бухпроводок не порождает (паевой взнос остаётся на 80);
    // членский взнос — Дт 80 / Кт 86: паевой уходит в целевое финансирование.
    const rows = await historyOfProcess(chairmanToken, orderHash)
    expect(postingsFor(rows, 'debit', ACC.SHARE, totalCost).length, 'резерв паевого взноса не должен порождать проводок').toBe(0)
    expect(postingsFor(rows, 'debit', ACC.SHARE, membershipFee).length, 'членский взнос обязан лечь Дт 80').toBeGreaterThan(0)
    expect(postingsFor(rows, 'credit', ACC.TARGET, membershipFee).length, 'членский взнос обязан лечь Кт 86').toBeGreaterThan(0)
  }, 300_000)

  it('закрывающая подпись приёмки ставит имущество на баланс по цене прибытия (o.mkt.purch, Дт 10 / Кт 60)', async () => {
    await gqlAs(sidorovToken, 'mutation($i:MarketplaceAcceptOrdersBatchInput!){ marketplaceAcceptOrdersBatch(input:$i){ __typename } }', {
      i: { order_ids: [orderId] },
    })

    // Партия сама не собирается: у предложений сида накопительный минимум по
    // КУ. Поставщик приезжает на ПВЗ — оператор оформляет экспресс-приёмку,
    // она создаёт АПП приёмки сразу. Факт задаём явно, чтобы цена прибытия
    // была детерминированной (по умолчанию берётся цена заказа).
    const ex: any = await gqlAs(chairkrgToken, `mutation($d:MarketplaceCreateExpressReceptionInput!){
      marketplaceCreateExpressReception(data:$d){ apl_receptions{ id status fact_quantity_per_order{ order_id fact_quantity fact_unit_price } } }
    }`, {
      d: {
        braname: BRANAME,
        offerer_account: sidorov.account,
        fact_quantity_per_order: [{ order_id: orderId, fact_quantity: ORDER_QTY, fact_unit_price: unitPrice.toFixed(4) }],
      },
    })
    const receptions = ex.marketplaceCreateExpressReception.apl_receptions as any[]
    // Экспресс-приёмка забирает все ожидающие заявки этого поставщика на КУ —
    // берём тот акт, в котором лежит наш заказ.
    const apl = receptions.find(r => r.fact_quantity_per_order.some((f: any) => f.order_id === orderId))
    expect(apl, 'экспресс-приёмка обязана включить наш заказ').toBeTruthy()

    // Двухподписный АПП: поставщик (id=1), затем председатель КУ (id=2).
    const sp: any = await gqlAs(sidorovToken, `query($d:MarketplaceAplReceptionByIdInput!){
      marketplaceAplReceptionSupplierSignablePayloads(data:$d){ full_title html hash meta binary }
    }`, { d: { apl_reception_id: apl.id } })
    const supplierSigned: any[] = []
    for (const p of sp.marketplaceAplReceptionSupplierSignablePayloads) {
      supplierSigned.push(await signAs(sidorov.wif, p, sidorov.account, 1))
    }
    await gqlAs(sidorovToken, `mutation($d:MarketplaceSignAplReceptionInput!){
      marketplaceSignAplReceptionAsSupplier(data:$d){ apl_reception{ id status } }
    }`, { d: { apl_reception_id: apl.id, signed_documents: supplierSigned } })

    const cp: any = await gqlAs(chairkrgToken, `query($d:MarketplaceAplReceptionByIdInput!){
      marketplaceAplReceptionChairmanSignablePayloads(data:$d){
        hash
        rawDocument{ full_title html hash meta binary }
        document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }
      }
    }`, { d: { apl_reception_id: apl.id } })
    const chairSigned: any[] = []
    for (const p of cp.marketplaceAplReceptionChairmanSignablePayloads) {
      chairSigned.push(await signAs(chairkrg.wif, p.rawDocument, chairkrg.account, 2, [p.document]))
    }
    const cs: any = await gqlAs(chairkrgToken, `mutation($d:MarketplaceSignAplReceptionInput!){
      marketplaceSignAplReceptionAsChairman(data:$d){ apl_reception{ id status chairman_signchair_tx_hash } }
    }`, { d: { apl_reception_id: apl.id, signed_documents: chairSigned } })
    expect(cs.marketplaceSignAplReceptionAsChairman.apl_reception.chairman_signchair_tx_hash, 'закрывающая подпись обязана уйти на цепь').toBeTruthy()

    ops = await waitForOps(chairmanToken, orderHash, ['o.mkt.purch'])

    const arrivalCost = ORDER_QTY * unitPrice
    expect(sumOf(ops, 'o.mkt.purch'), 'приёмка приходуется по цене прибытия × принятое количество').toBeCloseTo(arrivalCost, 2)

    const purch = ops.find(r => r.operationCode === 'o.mkt.purch')!
    expect(purch.username, 'обязательство по приёмке возникает перед ПОСТАВЩИКОМ, а не перед заказчицей').toBe(sidorov.account)

    const rows = await historyOfProcess(chairmanToken, orderHash)
    expect(postingsFor(rows, 'debit', ACC.MATERIALS, arrivalCost).length, 'приёмка обязана лечь Дт 10').toBeGreaterThan(0)
    expect(postingsFor(rows, 'credit', ACC.SUPPLIER, arrivalCost).length, 'приёмка обязана лечь Кт 60 — это закупка у поставщика').toBeGreaterThan(0)
  }, 300_000)

  it('выдача 3 из 4 списывает выданное по цене прибытия (o.mkt.consum) и разблокирует недовыдачу (o.mkt.unlock)', async () => {
    // Паевая модель: оператор фиксирует факт бандлом, пайщица подписывает
    // заявление о возврате паевого взноса имуществом, совет решает (на стенде —
    // голосованием членов совета), пайщица подписывает акт, оператор закрывает
    // выдачу второй подписью — только тут идут движения по средствам.
    const issued = await issueOrder({
      blockchain: bc,
      operatorToken: chairkrgToken,
      operator: chairkrg,
      memberToken: ekaterinaToken,
      member: ekaterina,
      orderId,
      braname: BRANAME,
      actualQuantity: ISSUED_QTY,
      actualUnitPrice: unitPrice,
    })
    expect(issued.orderIds).toContain(orderId)
    expect(issued.decisionId, 'заявление обязано попасть на повестку совета').toBeGreaterThan(0)

    ops = await waitForOps(chairmanToken, orderHash, ['o.mkt.consum', 'o.mkt.unlock'])

    const factCost = ISSUED_QTY * unitPrice
    expect(sumOf(ops, 'o.mkt.consum'), 'выбытие обязано считаться по цене прибытия, а не по цене продажи').toBeCloseTo(factCost, 2)
    expect(sumOf(ops, 'o.mkt.unlock'), 'недовыданный остаток резерва обязан вернуться заказчице').toBeCloseTo(totalCost - factCost, 2)

    const rows = await historyOfProcess(chairmanToken, orderHash)
    expect(postingsFor(rows, 'debit', ACC.SHARE, factCost).length, 'выдача обязана лечь Дт 80 — возврат паевого взноса имуществом').toBeGreaterThan(0)
    expect(postingsFor(rows, 'credit', ACC.MATERIALS, factCost).length, 'выдача обязана лечь Кт 10').toBeGreaterThan(0)

    // Резерв не должен уйти дважды: сумма consum + unlock равна телу заказа.
    expect(sumOf(ops, 'o.mkt.consum') + sumOf(ops, 'o.mkt.unlock'), 'выданное и разблокированное вместе обязаны закрыть весь резерв заказа').toBeCloseTo(totalCost, 2)
  }, 300_000)

  it('членский взнос пересчитывается по факту: излишек возвращается (o.mkt.refund), фактический уходит участку (o.mkt.fee → o.brn.common)', async () => {
    ops = await waitForOps(chairmanToken, orderHash, ['o.brn.common'])

    // Пропорция факта к заказу — та же, что применяет контракт (pro_rata).
    const factFee = membershipFee * (ISSUED_QTY / ORDER_QTY)

    expect(sumOf(ops, 'o.brn.common'), 'участку зачисляется взнос, приходящийся на фактически выданное').toBeCloseTo(factFee, 2)
    expect(sumOf(ops, 'o.mkt.refund'), 'неиспользованная часть взноса обязана вернуться заказчице').toBeCloseTo(membershipFee - factFee, 2)

    const accrued = ops.find(r => r.operationCode === 'o.brn.common')!
    expect(accrued.username, 'взнос зачисляется на кошелёк КУ выдачи, разрез — имя участка').toBe(BRANAME)

    const refunded = ops.find(r => r.operationCode === 'o.mkt.refund')!
    expect(refunded.username, 'возврат взноса адресован заказчице').toBe(ekaterina.account)

    // Недовыданный резерв возвращается на свободный паевой «Стола заказов»,
    // излишек взноса — на членский кошелёк программы: членский остаётся
    // членским и зачитывается при следующем заказе.
    const rowsAfter = await historyOfProcess(chairmanToken, orderHash)
    const toShare = rowsAfter.filter(r => r.action === 'walletop' && r.walletTo === 'w.mkt.share')
    expect(toShare.length, 'недовыданный резерв обязан прийти на свободный паевой «Стола заказов»').toBeGreaterThanOrEqual(1)
    const refundRows = rowsAfter.filter(r => r.action === 'walletop' && r.operationCode === 'o.mkt.refund')
    expect(refundRows.length, 'сторно взноса обязано быть переводом по кошелькам').toBeGreaterThan(0)
    for (const r of refundRows) {
      expect([r.walletFrom, r.walletTo], 'излишек взноса возвращается на членский кошелёк программы, не на паевой').toEqual(['w.mkt.fee', 'w.mkt.member'])
    }
    expect(rowsAfter.some(r => r.action === 'walletop' && r.walletFrom === 'w.mkt.fee' && r.walletTo === 'w.mkt.share'), 'членский взнос не транслируется обратно в паевой').toBe(false)

    // Взнос не должен раздвоиться: зачисленное участку плюс возвращённое
    // пайщику ровно равны заблокированному при оформлении.
    expect(sumOf(ops, 'o.brn.common') + sumOf(ops, 'o.mkt.refund'), 'зачисленный и возвращённый взнос вместе обязаны закрыть заблокированный при оформлении').toBeCloseTo(membershipFee, 2)

    // Движение кошельков взноса: пул «Стола заказов» → общий кошелёк участка.
    const rows = await historyOfProcess(chairmanToken, orderHash)
    const toBranch = rows.filter(r => r.action === 'walletop' && r.walletFrom === 'w.mkt.fee' && r.walletTo === 'w.brn.common')
    expect(toBranch.length, 'взнос обязан физически уйти с пула взносов на общий кошелёк участка').toBeGreaterThan(0)
    expect(amount(toBranch[0].quantity)).toBeCloseTo(factFee, 2)
  }, 300_000)

  it('l2.pnam.side.01: зачисление взноса участку идёт ниткой ПОСТАВКИ по хэшу заказа, а не ниткой экономики участка', async () => {
    const byOp = await processTypeByOperation(chairmanToken, orderHash)

    expect(byOp['o.brn.common'], 'инлайн-зачисление экономики КУ обязано называть нитку именем контракта-источника (поставка), '
    + 'иначе процесс заказа на столе бухгалтера подписывается «Членские взносы кооперативного участка»').toBe('p.mkt.supply')

    // Вся нитка заказа — одно имя: приход, выдача, взнос и его возврат.
    for (const code of ['o.mkt.lock', 'o.mkt.fee', 'o.mkt.purch', 'o.mkt.consum', 'o.mkt.unlock', 'o.mkt.refund']) {
      expect(byOp[code], `проводка ${code} обязана идти ниткой поставки`).toBe('p.mkt.supply')
    }
    if (expectedConvert > 0) {
      expect(byOp['o.mkt.conv'], 'конвертация по заявлению обязана идти ниткой поставки').toBe('p.mkt.supply')
    }

    // И реестр процессов отдаёт хэшу заказа ровно одно имя.
    const d: any = await gqlAs(chairmanToken, 'query($h:String!,$c:String!){ process(hash:$h, coopname:$c){ process_type } }', {
      h: orderHash.toLowerCase(),
      c: 'voskhod',
    })
    expect(d.process.process_type).toBe('p.mkt.supply')
  }, 180_000)

  it('нитка заказа не содержит посторонних денежных кодов', async () => {
    const codes = new Set(opsCodes(await applyOpsOfProcess(chairmanToken, orderHash)))
    const expected = new Set([
      'o.mkt.lock',
      'o.mkt.conv',
      'o.mkt.fee',
      'o.mkt.purch',
      'o.mkt.consum',
      'o.mkt.unlock',
      'o.mkt.refund',
      'o.brn.common',
    ])
    const unexpected = [...codes].filter(c => !expected.has(c))
    expect(unexpected, `в нитке заказа появились незапланированные проводки: ${unexpected.join(', ')}`).toEqual([])
    // Оплата поставщику — отдельное ленивое действие кассира (payout), в
    // нитке приёмки её быть не должно.
    expect(codes.has('o.mkt.payout'), 'выплата поставщику не должна происходить на приёмке').toBe(false)
  }, 180_000)
})
