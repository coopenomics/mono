/**
 * Оперативная память цепи в типовом процессе Стола заказов: поставка
 * имущества по заказу пайщика от оформления до закрытия заказа после
 * гарантийного срока.
 *
 * Тест ведёт один заказ тем же путём, что денежный тест поставки
 * (marketplace-money.test.ts): корзина → оформление → акцепт поставщика →
 * экспресс-приёмка на ПВЗ → двухподписный АПП → бандл выдачи → заявление
 * пайщика → решение совета → акт пайщика → закрывающая подпись оператора →
 * подтверждение выплаты поставщику кассиром → закрытие заказа
 * (`marketplace::closeorder`, его в работе зовёт ежедневный крон контроллера).
 * После каждого шага снимается память цепи (ramMeter.ts): сколько байт процесс
 * удерживает, пока ждёт следующего шага, у кого и в каких таблицах. Главное —
 * память, которую оплачивает кооператив; память контрактов и людей — полная
 * картина второй частью отчёта.
 *
 * Гарантийный срок. Крон закрывает заказ, когда срок вышел, а срок задаётся в
 * сутках (`warranty_days × 86400`). На время замера предложению ставится срок
 * 0 дней — заказ закрывается сразу после выплаты. Размер записи заказа от
 * длины срока не зависит: поля срока фиксированной ширины. Этап «гарантийный
 * срок» — это состояние «выдан, выплата проведена, ждёт закрытия»; сколько он
 * длится, задаёт таблица длительностей ниже, а не стенд.
 *
 * Цена памяти в AXON замеряется арендой (ramPrice.ts): кооператив платит
 * `powerup` на 1 AXON, прирост его квоты — байты за 1 AXON на срок аренды.
 *
 * Заказов два подряд, у каждого свой отчёт. Первый идёт на свежем стенде и
 * несёт записи «первого раза» — строку проверки памяти контракта, счётчики
 * шлюза, первые кошельки и счета пайщика. Второй — типовой: по нему видно, что
 * процесс оставляет после закрытия, когда эти записи уже есть.
 *
 * Набор измерительный, а не проверочный: в общий прогон boot он не входит и
 * запускается только с `RAM_COST_OUT` (workflow ram-cost.yaml).
 */
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GatewayContract, MarketContract } from 'cooptypes'
import Blockchain from '../../blockchain'
import config from '../../configs'
import { acceptToCoop, issueOrder, pickOffer, placeOrder } from '../marketplace/orderFlow'
import { CHAIRMAN, COOP, amount, ensureIdentityVerified, ensureShareFunds, fromState, gqlAs, loginAs } from '../marketplace/chainHelpers'
import { RamMeter, type RamPrice, type StageDays, axon, buildReport, fmt, writePrice, writeReport } from './ramMeter'
import { measureRamPrice } from './ramPrice'

const bc = new Blockchain(config.network, config.private_keys)

const BRANAME = 'krg'
const ORDER_QTY = 4

const ekaterina = fromState('ekaterina')
const sidorov = fromState('sidorov')
const chairkrg = fromState('chairkrg')

/**
 * Этапы процесса: ключ шага → что сделано и чего процесс ждёт дальше.
 * Порядок — порядок шагов в тесте.
 */
const STAGES: Record<string, { title: string, awaits: string }> = {
  'cart': { title: 'Корзина собрана', awaits: 'оформления заказа пайщиком' },
  'ordered': { title: 'Заказ оформлен, средства пайщика зарезервированы', awaits: 'акцепта поставщика' },
  'accepted': { title: 'Поставщик принял заказ', awaits: 'поставки на участок' },
  'reception': { title: 'Приёмка оформлена на ПВЗ', awaits: 'подписи поставщика в акте приёмки' },
  'supplier-signed': { title: 'Поставщик подписал акт приёмки', awaits: 'подписи председателя участка' },
  'received': { title: 'Имущество принято на склад участка', awaits: 'выдачи пайщику' },
  'proposal': { title: 'Оператор собрал выдачу', awaits: 'заявления пайщика' },
  'statement': { title: 'Пайщик подал заявление о выдаче', awaits: 'решения совета' },
  'decision': { title: 'Совет утвердил выдачу', awaits: 'подписи пайщика в акте выдачи' },
  'member-act': { title: 'Пайщик подписал акт выдачи', awaits: 'закрывающей подписи оператора' },
  'issued': { title: 'Заказ выдан, идёт гарантийный срок', awaits: 'выплаты поставщику кассиром' },
  'paid': { title: 'Выплата поставщику проведена, идёт гарантийный срок', awaits: 'конца гарантийного срока' },
  'closed': { title: 'Заказ закрыт, процесс завершён', awaits: '—' },
}

/**
 * Длительности этапов, сутки — допущения для байт·суток, не замер. Поставка
 * 3 дня от заказа до приёмки, сутки на складе, сутки на решение совета,
 * гарантия 3 дня от выдачи (срок засева витрины), выплата поставщику — в
 * первые сутки гарантии. Переопределяются `RAM_COST_DAYS` (JSON ключ → сутки).
 */
const DEFAULT_DAYS: StageDays = {
  ordered: 1,
  accepted: 2,
  received: 1,
  statement: 1,
  issued: 1,
  paid: 2,
}

const PROCESS = 'поставка по заказу Стола заказов (от оформления до закрытия после гарантии)'

let chairmanToken = ''
let ekaterinaToken = ''
let sidorovToken = ''
let chairkrgToken = ''
let offer: any
let originalWarrantyDays: number | null = null
let price: RamPrice | null = null
/** Измерители заказов по порядку: первый — на свежем стенде, второй — типовой. */
const meters: { slug: string, title: string, meter: RamMeter }[] = []

async function setWarranty(days: number): Promise<void> {
  await gqlAs(chairmanToken, 'mutation($i:MarketplaceSetOfferWarrantyInput!){ marketplaceSetOfferWarranty(input:$i){ id warranty_days } }', {
    i: { offer_id: offer.id, warranty_days: days },
  })
}

function stageDays(): StageDays {
  return { ...DEFAULT_DAYS, ...(process.env.RAM_COST_DAYS ? JSON.parse(process.env.RAM_COST_DAYS) : {}) }
}

/** Один заказ от корзины до закрытия; память снимается после каждого шага. */
async function runOrder(meter: RamMeter): Promise<void> {
  const mark = async (key: string) => {
    const s = STAGES[key]
    if (!s)
      throw new Error(`этап ${key} не описан в STAGES`)
    await meter.stage(key, s.title, s.awaits)
  }

  // Всё, что пишет в цепь вне процесса, — до снимка «до процесса»:
  // пополнение паевого и подтверждение личности получателя.
  await ensureShareFunds(ekaterina.account, ORDER_QTY * amount(offer.price_per_unit) * 2, ekaterinaToken)
  await ensureIdentityVerified(ekaterina.account)
  await gqlAs(ekaterinaToken, 'mutation{ marketplaceClearCart{ __typename } }').catch(() => {})
  await meter.measureIdle()
  await meter.stage('before', 'До процесса', 'заказа пайщика')

  const { orderId, orderHash } = await placeOrder({
    token: ekaterinaToken,
    who: ekaterina,
    offerId: offer.id,
    quantity: ORDER_QTY,
    braname: BRANAME,
    onStep: mark,
  })
  await mark('ordered')

  const unitPrice = amount(offer.price_per_unit)
  await acceptToCoop({
    supplierToken: sidorovToken,
    supplier: sidorov,
    operatorToken: chairkrgToken,
    operator: chairkrg,
    orderId,
    braname: BRANAME,
    factQuantity: ORDER_QTY,
    factUnitPrice: unitPrice,
    onStep: mark,
  })
  await mark('received')

  await issueOrder({
    blockchain: bc,
    operatorToken: chairkrgToken,
    operator: chairkrg,
    memberToken: ekaterinaToken,
    member: ekaterina,
    orderId,
    braname: BRANAME,
    actualQuantity: ORDER_QTY,
    actualUnitPrice: unitPrice,
    onStep: mark,
  })
  await mark('issued')

  // Кассир подтверждает выплату, которую бэкенд выставил на приёмке.
  await bc.api.transact({
    actions: [{
      account: GatewayContract.contractName.production,
      name: GatewayContract.Actions.CompleteOutcome.actionName,
      authorization: [{ actor: COOP, permission: 'active' }],
      data: { coopname: COOP, outcome_hash: orderHash },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
  await mark('paid')

  // То же действие зовёт крон закрытия контроллера после гарантийного срока.
  await bc.api.transact({
    actions: [{
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.CloseOrder.actionName,
      authorization: [{ actor: COOP, permission: 'active' }],
      data: { coopname: COOP, order_hash: orderHash },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
  await mark('closed')

  expect(meter.stages.map(s => s.key)).toEqual(['before', ...Object.keys(STAGES)])
}

describe.runIf(process.env.RAM_COST_OUT)('оперативная память: поставка по заказу Стола заказов', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    chairmanToken = await loginAs(CHAIRMAN)
    ekaterinaToken = await loginAs(ekaterina)
    sidorovToken = await loginAs(sidorov)
    chairkrgToken = await loginAs(chairkrg)

    offer = await pickOffer(chairmanToken, sidorov.account, BRANAME, 'Мёд цветочный')
    originalWarrantyDays = Number(offer.warranty_days ?? 0)
    await setWarranty(0)
  }, 600_000)

  afterAll(async () => {
    if (offer && originalWarrantyDays !== null)
      await setWarranty(originalWarrantyDays).catch(e => console.warn(`гарантию предложения не вернуть: ${e?.message ?? e}`))
    for (const { slug, title, meter } of meters) {
      if (meter.stages.length < 2)
        continue
      const report = buildReport(title, meter, stageDays(), price)
      const file = writeReport(report, slug)
      const c = report.payer_totals
      console.log(`[ram-cost] ${slug}: кооператив пик ${fmt(c.peak.bytes)} (${c.peak.stage}), за процесс ${axon(c.axon)}, остаток ${fmt(c.residual_bytes)}; вся цепь пик ${fmt(report.totals.peak.bytes)}; отчёт ${file}`)
    }
  }, 120_000)

  it('цена памяти: аренда кооперативу на 1 AXON', async () => {
    price = await measureRamPrice(bc, COOP)
    writePrice(price)
    console.log(`[ram-cost] 1 AXON → ${price.bytes_per_payment} Б на ${price.powerup_days} сут (по формуле ${price.expected_bytes_by_formula} Б); 1 Б·сут = ${price.axon_per_byte_day} AXON`)
    expect(price.bytes_per_payment).toBeGreaterThan(0)
  }, 300_000)

  it('типовой заказ на свежем стенде проходит путь до закрытия', async () => {
    const meter = new RamMeter(COOP)
    meters.push({ slug: 'marketplace-order-first', title: `${PROCESS}, первый заказ на свежем стенде`, meter })
    await runOrder(meter)
  }, 1_800_000)

  it('второй такой же заказ: память без записей «первого раза»', async () => {
    const meter = new RamMeter(COOP)
    meters.push({ slug: 'marketplace-order', title: `${PROCESS}, второй заказ — типовой`, meter })
    await runOrder(meter)
  }, 1_800_000)
})
