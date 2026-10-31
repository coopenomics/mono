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
 *   • o.mkt.conv   — если свободного паевого Стола заказов не хватает,
 *                    недостающее транслируется из Цифрового кошелька по
 *                    заявлению 1110 без проводки (задача 99D-18);
 *   • o.mkt.fee    — обеспечительная часть паевого взноса по ставке кооператива
 *                    со свободного паевого в пул под заказ, без проводки;
 *   • o.mkt.purch  — закрывающая подпись приёмки ставит имущество на баланс (Дт 10 / Кт 76)
 *                    по ЦЕНЕ ПРИБЫТИЯ (Дт 10 / Кт 86), а не по цене заказа;
 *   • o.mkt.consum — выдача списывает выданное по цене прибытия (Дт 80 / Кт 10);
 *   • o.mkt.payout — подтверждение кассиром выплаты поставщику проводит Дт 76 / Кт 51
 *                    на ПРИНЯТУЮ стоимость (mkt.supply.happy.33, задача 99D-14),
 *                    даже если заказчице к этому моменту выдали меньше;
 *   • o.mkt.unlock — недовыдача разблокирует невыданный остаток заказчицы;
 *   • o.mkt.refund — неиспользованная обеспечительная часть возвращается пропорционально;
 *   • o.mkt.todue  — факт обеспечительной части ложится на кошелёк пайщика к
 *                    списанию НИТКОЙ ПОСТАВКИ по хэшу заказа; членским взносом
 *                    участка она станет после гарантийного срока (chargedue).
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
import { GatewayContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { issueOrder, pickOffer } from './marketplace/orderFlow'
import { ACC, CHAIRMAN, COOP, type LedgerRow, amount, applyOpsOfProcess, ensureShareFunds, fromState, gqlAs, historyOfProcess, loginAs, opsCodes, processTypeByOperation, signAs, sumOf, waitForOps, waitForOrderMirror, docMeta } from './marketplace/chainHelpers'

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
/** Членская часть перевода по заявлению 1110 из превью (0 — заявления не было). */
let expectedConvert = 0
/** Хеш заявления 1110 — нитка перевода в ledger2. */
let convertHash = ''

/** Проводки нитки заказа — переиспользуются несколькими ассертами. */
let ops: LedgerRow[] = []

/** Строки debit/credit нитки: по ним ассертится «Дт 10 / Кт 86» и т. п. */
function postingsFor(rows: LedgerRow[], action: 'debit' | 'credit', accountId: number, value: number) {
  return rows.filter(r => r.action === action && r.accountId === accountId && Math.abs(amount(r.quantity) - value) < 0.005)
}

describe('стол заказов — денежные места поставки и выдачи (contract, живая цепь)', () => {
  beforeAll(async () => {
    // Клиент подписи создаёт update_pass_instance: без него bc.api пуст, и
    // подтверждение выплаты кассиром падало на undefined.transact.
    await bc.update_pass_instance()
    chairmanToken = await loginAs(CHAIRMAN)
    sidorovToken = await loginAs(sidorov)
    ekaterinaToken = await loginAs(ekaterina)
    chairkrgToken = await loginAs(chairkrg)

    // Берём любое активное предложение фонового поставщика с поставкой на наш
    // КУ: суммы теста считаются от заказа, поэтому конкретный товар не важен —
    // важно лишь, что предложение sidorov'а живое и доставляется на krg.
    // Общий помощник ждёт, пока индексер донесёт одобрение засева до контроллера.
    offer = await pickOffer(chairmanToken, sidorov.account, BRANAME, 'Мёд цветочный')
    unitPrice = amount(offer.price_per_unit)

    // Каждый прогон списывает с паевого заказчицы тело заказа и обеспечительную часть.
    // Без дозаправки тест повторяем лишь пока не иссякнет остаток из сида, а
    // потом падает на «Недостаточно средств» — и это выглядит как регресс,
    // хотя это исчерпание фикстуры. Запас — двукратный от тела заказа.
    await ensureShareFunds(ekaterina.account, ORDER_QTY * unitPrice * 2, ekaterinaToken)
  }, 180_000)

  it('оформление заказа: трансляция по заявлению (o.mkt.conv), обеспечительная часть (o.mkt.fee) и тело паевым резервом — одной ниткой заказа без проводок', async () => {
    // Корзина может держать хвост прошлого прогона — начинаем с чистой.
    await gqlAs(ekaterinaToken, 'mutation{ marketplaceClearCart{ __typename } }').catch(() => {})
    await gqlAs(ekaterinaToken, 'mutation($i:MarketplaceAddToCartInput!){ marketplaceAddToCart(input:$i){ __typename } }', {
      i: { offer_id: offer.id, quantity: ORDER_QTY, delivery_braname: BRANAME },
    })

    // Оформление (паевая модель) = превью + мутация оформления корзины.
    // Обеспечительная часть и тело покрываются свободным паевым Стола заказов,
    // нехватка — трансляция по заявлению 1110; пайщица подписывает его один раз.
    const sp: any = await gqlAs(ekaterinaToken, `query{
      marketplaceCheckoutSignablePayloads{
        lines{ offer_id package_id order_hash amount membership_fee from_program from_wallet }
        convert{ amount membership_fee document{ full_title html hash meta binary } }
      }
    }`)
    const preview = sp.marketplaceCheckoutSignablePayloads
    expect(preview.lines.length, 'по позиции корзины обязано прийти превью оформления').toBeGreaterThan(0)
    const line = preview.lines[0]
    expect(amount(line.from_program) + amount(line.from_wallet), 'части позиции обязаны складываться в её стоимость с обеспечительной частью').toBeCloseTo(amount(line.amount), 2)
    // Заявление есть ровно тогда, когда с Цифрового кошелька что-то уходит.
    expect(!!preview.convert, 'заявление приходит только на недостающее').toBe(amount(line.from_wallet) > 0.005)
    expectedConvert = preview.convert ? amount(preview.convert.amount) : 0
    if (preview.convert) {
      const stmtMeta = docMeta(preview.convert.document.meta)
      expect(amount(stmtMeta.amount), 'в заявлении — только то, чего не хватило на свободном паевом').toBeCloseTo(amount(line.from_wallet), 2)
      // Общие поля меты любого документа фабрики (версия шаблона, генератор,
      // блок, часовой пояс и пр.) — не данные заявления; «лишним» считается
      // только доменное поле сверх перечня.
      const BASE_META = new Set(['block_num', 'builder', 'generator', 'links', 'timezone', 'title', 'version'])
      expect(Object.keys(stmtMeta).filter(k => !BASE_META.has(k)).sort(), 'в мете заявления нет лишних полей').toEqual(['amount', 'coopname', 'created_at', 'lang', 'membership_fee', 'order_hash', 'registry_id', 'skip_save', 'username'].filter(k => k in stmtMeta).sort())
      convertHash = preview.convert.document.hash
    }

    const lines = preview.lines.map((p: any) => ({ offer_id: p.offer_id, package_id: p.package_id, order_hash: p.order_hash }))
    const signed_convert = preview.convert ? await signAs(ekaterina.wif, preview.convert.document, ekaterina.account, 1) : null

    const co: any = await gqlAs(ekaterinaToken, `mutation($i:MarketplaceCheckoutCartInput){
      marketplaceCheckoutCart(input:$i){ fully_completed created_orders{ id status } failed_lines{ reason } }
    }`, { i: { lines, signed_convert } })
    const result = co.marketplaceCheckoutCart
    expect(result.fully_completed, `оформление обязано пройти целиком: ${JSON.stringify(result.failed_lines)}`).toBe(true)
    orderId = result.created_orders[0].id

    // Хэш заказа известен сразу — суммы зеркала доезжают дельтой позже.
    const created: any = await gqlAs(ekaterinaToken, `query($i:MarketplaceGetOrderInput!){
      marketplaceGetOrder(input:$i){ id order_hash }
    }`, { i: { order_id: orderId } })
    orderHash = created.marketplaceGetOrder.order_hash

    ops = await waitForOps(chairmanToken, orderHash, ['o.mkt.fee'])
    // Со свободного паевого программы — сначала обеспечительная часть
    // (o.mkt.fee), затем тело (o.mkt.lockp); остаток тела — с Цифрового
    // кошелька (o.mkt.lock), но после трансляции его нет.
    const lockAmount = sumOf(ops, 'o.mkt.lock') + sumOf(ops, 'o.mkt.lockp')
    const feeAmount = sumOf(ops, 'o.mkt.fee')
    const rowsCreate = await historyOfProcess(chairmanToken, orderHash)
    for (const r of rowsCreate.filter(r => r.action === 'walletop' && r.operationCode === 'o.mkt.fee')) {
      expect([r.walletFrom, r.walletTo], 'обеспечительная часть берётся со свободного паевого программы').toEqual(['w.mkt.share', 'w.mkt.fee'])
    }
    for (const r of rowsCreate.filter(r => r.action === 'walletop' && r.operationCode === 'o.mkt.lockp')) {
      expect([r.walletFrom, r.walletTo], 'часть тела со свободного паевого программы').toEqual(['w.mkt.share', 'w.mkt.order'])
    }
    for (const r of rowsCreate.filter(r => r.action === 'walletop' && r.operationCode === 'o.mkt.lock')) {
      expect([r.walletFrom, r.walletTo], 'паевая часть тела ложится паевым резервом').toEqual(['w.wal.share', 'w.mkt.order'])
    }
    // Перевод по заявлению (если был) идёт первым шагом ЭТОЙ ЖЕ нитки: тип
    // процесса один, значит и идентификатор обязан быть один (уточнение
    // владельца 08.09.2026) — своей нитки по хешу заявления больше нет.
    if (expectedConvert > 0) {
      const convOps = await waitForOps(chairmanToken, orderHash, ['o.mkt.conv'])
      expect(sumOf(convOps, 'o.mkt.conv'), 'транслируется ровно сумма заявления').toBeCloseTo(expectedConvert, 2)
      for (const r of rowsCreate.filter(r => r.action === 'walletop' && r.operationCode === 'o.mkt.conv')) {
        expect([r.walletFrom, r.walletTo], 'трансляция идёт с главного паевого на свободный паевой программы').toEqual(['w.wal.share', 'w.mkt.share'])
      }
      expect(await historyOfProcess(chairmanToken, convertHash), 'нитки по хешу заявления быть не должно — трансляция живёт в нитке заказа').toEqual([])
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
    // Обеспечительная часть — отдельная сумма СВЕРХ тела.
    expect(amount(order.total_cost_with_fee)).toBeCloseTo(totalCost + membershipFee, 2)
    expect(membershipFee, 'ставка обеспечительной части обязана быть больше нуля, иначе денежное место не проверяемо').toBeGreaterThan(0)

    expect(lockAmount, 'резерв обязан равняться телу заказа').toBeCloseTo(totalCost, 2)
    expect(feeAmount, 'обеспечительная часть обязана равняться ставке, зафиксированной в заказе').toBeCloseTo(membershipFee, 2)

    const lockRow = ops.find(r => r.operationCode === 'o.mkt.lock' || r.operationCode === 'o.mkt.lockp')!
    expect(lockRow.username, 'резерв ставится на заказчицу').toBe(ekaterina.account)

    // Трансляция, обеспечительная часть и резерв проводок не порождают: всё
    // остаётся паевым взносом на счёте 80 (задача 99D-18).
    const rows = await historyOfProcess(chairmanToken, orderHash)
    const postings = rows.filter(r => r.action === 'debit' || r.action === 'credit')
    expect(postings.length, 'оформление заказа проводок не порождает').toBe(0)
  }, 300_000)

  it('закрывающая подпись приёмки ставит имущество на баланс по цене прибытия (o.mkt.purch, Дт 10 / Кт 76)', async () => {
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
    expect(postingsFor(rows, 'credit', ACC.SETTLEMENTS, arrivalCost).length, 'приёмка обязана лечь Кт 76 — это закупка у поставщика').toBeGreaterThan(0)

    // Зеркало заказа знает принятую стоимость — по ней считается выплата
    // поставщику. До 24.09.2026 контроллер не записывал это поле вовсе.
    await waitForOrderMirror(ekaterinaToken, orderId, o => Math.abs(amount(o.accepted_cost) - arrivalCost) < 0.005, 30_000)
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
    const consumed = sumOf(ops, 'o.mkt.consum')
    const unlocked = sumOf(ops, 'o.mkt.unlock')
    expect(consumed, 'выбытие обязано считаться по цене прибытия, а не по цене продажи').toBeCloseTo(factCost, 2)
    expect(unlocked, 'недовыданный остаток резерва обязан вернуться заказчице').toBeCloseTo(totalCost - factCost, 2)

    const rows = await historyOfProcess(chairmanToken, orderHash)
    expect(postingsFor(rows, 'debit', ACC.SHARE, factCost).length, 'выдача обязана лечь Дт 80 — возврат паевого взноса имуществом').toBeGreaterThan(0)
    expect(postingsFor(rows, 'credit', ACC.MATERIALS, factCost).length, 'выдача обязана лечь Кт 10').toBeGreaterThan(0)

    // Резерв не должен уйти дважды: сумма consum + unlock равна телу заказа.
    expect(consumed + unlocked, 'выданное и разблокированное вместе обязаны закрыть весь резерв заказа').toBeCloseTo(totalCost, 2)
  }, 300_000)

  it('обеспечительная часть пересчитывается по факту: излишек возвращается (o.mkt.refund), факт ложится к списанию (o.mkt.todue)', async () => {
    ops = await waitForOps(chairmanToken, orderHash, ['o.mkt.todue'])

    // Пропорция факта к заказу — та же, что применяет контракт (pro_rata).
    const factFee = membershipFee * (ISSUED_QTY / ORDER_QTY)

    expect(sumOf(ops, 'o.mkt.todue'), 'к списанию ложится обеспечительная часть фактически выданного').toBeCloseTo(factFee, 2)
    expect(sumOf(ops, 'o.mkt.refund'), 'неиспользованная обеспечительная часть обязана вернуться заказчице').toBeCloseTo(membershipFee - factFee, 2)
    expect(sumOf(ops, 'o.brn.common'), 'на выдаче членского взноса участку нет: он появится при списании после гарантии').toBeCloseTo(0, 2)

    const due = ops.find(r => r.operationCode === 'o.mkt.todue')!
    expect(due.username, 'к списанию — на кошелёк заказчицы').toBe(ekaterina.account)

    // Недовыданный резерв и излишек обеспечительной части возвращаются на
    // свободный паевой «Стола заказов».
    const rowsAfter = await historyOfProcess(chairmanToken, orderHash)
    const toShare = rowsAfter.filter(r => r.action === 'walletop' && r.walletTo === 'w.mkt.share' && r.operationCode === 'o.mkt.unlock')
    expect(toShare.length, 'недовыданный резерв обязан прийти на свободный паевой «Стола заказов»').toBeGreaterThanOrEqual(1)
    for (const r of rowsAfter.filter(r => r.action === 'walletop' && r.operationCode === 'o.mkt.refund')) {
      expect([r.walletFrom, r.walletTo], 'излишек обеспечительной части возвращается на свободный паевой').toEqual(['w.mkt.fee', 'w.mkt.share'])
    }
    for (const r of rowsAfter.filter(r => r.action === 'walletop' && r.operationCode === 'o.mkt.todue')) {
      expect([r.walletFrom, r.walletTo], 'факт обеспечительной части — на кошелёк к списанию').toEqual(['w.mkt.fee', 'w.mkt.due'])
    }

    // Обеспечительная часть не раздваивается: к списанию плюс возвращённое
    // ровно равны внесённому при оформлении.
    expect(sumOf(ops, 'o.mkt.todue') + sumOf(ops, 'o.mkt.refund'), 'к списанию и возвращённое вместе обязаны закрыть внесённое при оформлении').toBeCloseTo(membershipFee, 2)

    // До списания счёт 86 нитка заказа не задевает.
    expect(rowsAfter.filter(r => (r.action === 'debit' || r.action === 'credit') && r.accountId === ACC.TARGET).length, 'до списания счёт 86 не задет').toBe(0)
  }, 300_000)

  it('mkt.secure.due: списание по условиям ЦПП (chargedue) — Дт 80 / Кт 86 в общий кошелёк участка ниткой поставки; больше остатка — отказ', async () => {
    const factFee = membershipFee * (ISSUED_QTY / ORDER_QTY)
    const charge = (sum: number) => bc.transactWithLogs([{
      account: 'marketplace',
      name: 'chargedue',
      authorization: [{ actor: COOP, permission: 'active' }],
      data: { coopname: COOP, username: ekaterina.account, braname: BRANAME, order_hash: orderHash, amount: `${sum.toFixed(4)} RUB` },
    }])

    // Контракт держит потолок остатка кошелька к списанию.
    await expect(charge(1_000_000)).rejects.toThrow(/MARKETPLACE_DUE_EXCEEDS/)

    // Бэкенд списывает первого числа после гарантии; здесь зовём действие
    // напрямую ключом кооператива — контракт сроки не проверяет.
    await charge(Number(factFee.toFixed(4)))
    ops = await waitForOps(chairmanToken, orderHash, ['o.mkt.charge', 'o.brn.common'])
    expect(sumOf(ops, 'o.mkt.charge'), 'списано ровно названное').toBeCloseTo(factFee, 2)
    expect(sumOf(ops, 'o.brn.common'), 'вся списанная сумма зачислена участку').toBeCloseTo(factFee, 2)
    expect(ops.find(r => r.operationCode === 'o.brn.common')!.username, 'зачисление на кошелёк участка выдачи').toBe(BRANAME)

    const rows = await historyOfProcess(chairmanToken, orderHash)
    expect(postingsFor(rows, 'debit', ACC.SHARE, factFee).length, 'списание обязано лечь Дт 80').toBeGreaterThan(0)
    expect(postingsFor(rows, 'credit', ACC.TARGET, factFee).length, 'списание обязано лечь Кт 86').toBeGreaterThan(0)
    const toBranch = rows.filter(r => r.action === 'walletop' && r.walletFrom === 'w.mkt.fee' && r.walletTo === 'w.brn.common')
    expect(toBranch.length, 'членский взнос обязан физически поступить на общий кошелёк участка').toBeGreaterThan(0)
  }, 300_000)

  it('l2.pnam.side.01: списание и зачисление участку идут ниткой ПОСТАВКИ по хэшу заказа, а не ниткой экономики участка', async () => {
    const byOp = await processTypeByOperation(chairmanToken, orderHash)

    expect(byOp['o.brn.common'], 'инлайн-зачисление экономики КУ обязано называть нитку именем контракта-источника (поставка), '
    + 'иначе процесс заказа на столе бухгалтера подписывается «Членские взносы кооперативного участка»').toBe('p.mkt.supply')

    // Вся нитка заказа — одно имя: приход, выдача, обеспечительная часть, её возврат и списание.
    for (const code of ['o.mkt.fee', 'o.mkt.purch', 'o.mkt.consum', 'o.mkt.unlock', 'o.mkt.refund', 'o.mkt.todue', 'o.mkt.charge']) {
      expect(byOp[code], `проводка ${code} обязана идти ниткой поставки`).toBe('p.mkt.supply')
    }
    for (const code of ['o.mkt.lock', 'o.mkt.lockp']) {
      if (byOp[code] !== undefined) expect(byOp[code], `проводка ${code} обязана идти ниткой поставки`).toBe('p.mkt.supply')
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
      'o.mkt.lockp',
      'o.mkt.fee',
      'o.mkt.purch',
      'o.mkt.consum',
      'o.mkt.unlock',
      'o.mkt.refund',
      'o.mkt.todue',
      'o.mkt.charge',
      'o.brn.common',
    ])
    // Трансляция по заявлению живёт в нитке заказа (уточнение владельца 08.09.2026,
    // проверка оформления выше) — она запланирована, если заявление было.
    if (expectedConvert > 0) expected.add('o.mkt.conv')
    const unexpected = [...codes].filter(c => !expected.has(c))
    expect(unexpected, `в нитке заказа появились незапланированные проводки: ${unexpected.join(', ')}`).toEqual([])
    // Оплата поставщику — отдельное ленивое действие кассира (payout), в
    // нитке приёмки её быть не должно.
    expect(codes.has('o.mkt.payout'), 'выплата поставщику не должна происходить на приёмке').toBe(false)
  }, 180_000)

  it('mkt.supply.happy.33: подтверждение выплаты после выдачи 3 из 4 проводит Дт 76 / Кт 51 на принятую стоимость, а не на сумму выдачи', async () => {
    // Выплату поставщику бэкенд инициировал сразу после закрывающей подписи
    // приёмки: в шлюзе лежит исходящий платёж с хэшем заказа на принятую
    // сумму. Кассир подтверждает его уже после выдачи — заявление о выдаче к
    // этому моменту перезаписало факт заказа (3 из 4), но долг поставщику
    // сложился на приёмке и от выдачи не зависит.
    await bc.api.transact({
      actions: [{
        account: GatewayContract.contractName.production,
        name: GatewayContract.Actions.CompleteOutcome.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data: { coopname: COOP, outcome_hash: orderHash },
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    ops = await waitForOps(chairmanToken, orderHash, ['o.mkt.payout'])

    const acceptedCost = ORDER_QTY * unitPrice
    const issuedCost = ISSUED_QTY * unitPrice
    const paid = sumOf(ops, 'o.mkt.payout')
    expect(paid, 'выплата обязана идти на принятую стоимость — столько кассир перевёл в банк').toBeCloseTo(acceptedCost, 2)
    expect(Math.abs(paid - issuedCost) > 0.005, 'выплата не должна повторять сумму выдачи').toBe(true)

    const rows = await historyOfProcess(chairmanToken, orderHash)
    expect(postingsFor(rows, 'debit', ACC.SETTLEMENTS, acceptedCost).length, 'выплата обязана лечь Дт 76').toBeGreaterThan(0)
    expect(postingsFor(rows, 'credit', ACC.CASH, acceptedCost).length, 'выплата обязана лечь Кт 51').toBeGreaterThan(0)

    // Долг поставщику по заказу закрыт ровно: кредит 76 приёмки равен дебету 76 выплаты.
    const credit76 = rows.filter(r => r.action === 'credit' && r.accountId === ACC.SETTLEMENTS).reduce((s, r) => s + amount(r.quantity), 0)
    const debit76 = rows.filter(r => r.action === 'debit' && r.accountId === ACC.SETTLEMENTS).reduce((s, r) => s + amount(r.quantity), 0)
    expect(credit76 - debit76, 'на счёте 76 по заказу не должно остаться долга').toBeCloseTo(0, 2)
  }, 300_000)
})
