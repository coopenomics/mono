/**
 * Заявление 1110 и внутренний членский кошелёк Стола заказов — денежные места
 * паевой модели по уточнению владельца 06.09.2026 (реестр: mkt.order.side.33,
 * mkt.order.side.34, mkt.stock.side.08):
 *   • createorder без подготовленного членского кошелька (взнос не покрыт) —
 *     контракт отвергает с подсказкой подать заявление; средств не трогает;
 *   • перевод по заявлению (convert) кладёт на членский кошелёк ровно членскую
 *     часть, после чего тот же createorder проходит; перевод адресован заказу и
 *     идёт первой операцией его нитки (уточнение владельца 08.09.2026);
 *   • заявление — на тело плюс взнос за вычетом остатка членского кошелька;
 *     тело всегда ложится паевым резервом (o.mkt.lock);
 *   • stockorder без покрытого взноса отвергается так же, как createorder.
 *
 * Живой стенд с сидом docs-harness (фикстуры пайщиков в state/). Контрактные
 * шаги идут напрямую в цепь ключом кооператива (как это делает бэкенд).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { pickOffer, placeOrder } from './marketplace/orderFlow'
import { amount, ensureShareFunds, fromState, gqlAs, historyOfProcess, loginAs, signAs, sumOf, waitForOps } from './marketplace/chainHelpers'

const BRANAME = 'krg'
const COOPNAME = 'voskhod'

const sidorov = fromState('sidorov')
const ekaterina = fromState('ekaterina')
const chairman = fromState('ant')

const bc = new Blockchain(config.network, config.private_keys)

let ekaterinaToken = ''
let chairmanToken = ''
let offer: any
let unitPrice = 0

function sha256Hex(s: string): string {
  return require('node:crypto').createHash('sha256').update(s).digest('hex')
}

async function memberAvailable(token: string): Promise<number> {
  const d: any = await gqlAs(token, 'query{ marketplaceMemberWallet{ wallets{ name available } } }').catch(() => null)
  const row = d?.marketplaceMemberWallet?.wallets?.find((w: any) => w.name === 'w.mkt.member')
  return row ? amount(row.available) : 0
}

async function createOrderDirect(orderHash: string, quantity: number): Promise<any> {
  return bc.transactWithLogs([{
    account: 'marketplace',
    name: 'createorder',
    authorization: [{ actor: COOPNAME, permission: 'active' }],
    data: {
      coopname: COOPNAME,
      orderer: ekaterina.account,
      order_hash: orderHash,
      offer_hash: sha256Hex(`offer:${offer.id}`),
      offerer: sidorov.account,
      delivery_braname: BRANAME,
      quantity: `${quantity.toFixed(3)} PCS`,
      unit_price: `${unitPrice.toFixed(4)} RUB`,
      package_size: '0.000 PCS',
      warranty_period_secs: 0,
      batch_hash: '0'.repeat(64),
    },
  }])
}

describe('Стол заказов: заявление 1110 и внутренний членский кошелёк', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    ekaterinaToken = await loginAs(ekaterina)
    chairmanToken = await loginAs(chairman)
    offer = await pickOffer(ekaterinaToken, sidorov.account, BRANAME, 'Мёд цветочный')
    unitPrice = amount(offer.price_per_unit)
    await ensureShareFunds(ekaterina.account, unitPrice * 6)
  }, 180_000)

  it('mkt.order.side.33: createorder без покрытого членским кошельком взноса отвергается — контракт велит сначала подать заявление', async () => {
    // Опустошаем членский кошелёк оформлениями: превью переводит ровно недостающую
    // часть взноса, после заказа остаток кошелька — прежний минус взнос (или ноль).
    let left = await memberAvailable(ekaterinaToken)
    for (let i = 0; i < 4 && left >= unitPrice * 0.3 - 0.005; i++) {
      await placeOrder({ token: ekaterinaToken, who: ekaterina, offerId: offer.id, quantity: 1, braname: BRANAME })
      left = await memberAvailable(ekaterinaToken)
    }
    expect(left, 'членского кошелька на взнос очередного заказа не хватает').toBeLessThan(unitPrice * 0.3 - 0.005)

    const orderHash = sha256Hex(`side33|${Date.now()}`)
    await expect(createOrderDirect(orderHash, 1)).rejects.toThrow(/Недостаточно членских средств Стола заказов на членский взнос/)
    const rows = await historyOfProcess(chairmanToken, orderHash).catch(() => [])
    expect(rows.length, 'отвергнутый заказ не оставляет движений').toBe(0)
  }, 300_000)

  it('mkt.order.side.34: перевод по заявлению кладёт на членский кошелёк ровно членскую часть, после чего заказ проходит', async () => {
    // Превью: членского кошелька на взнос не хватает — заявление на тело плюс недостающую часть.
    await gqlAs(ekaterinaToken, 'mutation{ marketplaceClearCart{ __typename } }').catch(() => {})
    await gqlAs(ekaterinaToken, 'mutation($i:MarketplaceAddToCartInput!){ marketplaceAddToCart(input:$i){ __typename } }', {
      i: { offer_id: offer.id, quantity: 1, delivery_braname: BRANAME },
    })
    const sp: any = await gqlAs(ekaterinaToken, `query{
      marketplaceCheckoutSignablePayloads{
        lines{ order_hash amount membership_fee from_member from_program from_wallet }
        convert{ amount membership_fee document{ full_title html hash meta binary } }
      }
    }`)
    const preview = sp.marketplaceCheckoutSignablePayloads
    expect(preview.convert, 'кошельков программы не хватает — превью обязано принести заявление').toBeTruthy()
    const line = preview.lines[0]
    expect(amount(preview.convert.amount), 'заявление — только на то, чего не хватило в кошельках программы').toBeCloseTo(amount(line.from_wallet), 2)
    expect(amount(preview.convert.membership_fee), 'членская часть — взнос за вычетом остатка кошелька').toBeCloseTo(amount(line.membership_fee) - amount(line.from_member), 2)
    expect(amount(preview.convert.membership_fee), 'кошелька на взнос не хватало — членская часть больше нуля').toBeGreaterThan(0)
    const meta = JSON.parse(preview.convert.document.meta)
    expect(meta.registry_id).toBe(1110)
    expect(preview.convert.document.html, 'текст заявления — слова владельца').toMatch(/Прошу перевести с баланса моего Цифрового кошелька/)
    expect(preview.convert.document.html).not.toMatch(/ставк|зачит/i)

    // Оформление: перевод адресован заказу и ложится в его нитку, затем заказ.
    const signed = await signAs(ekaterina.wif, preview.convert.document, ekaterina.account, 1)
    const co: any = await gqlAs(ekaterinaToken, `mutation($i:MarketplaceCheckoutCartInput){
      marketplaceCheckoutCart(input:$i){ fully_completed created_orders{ id order_hash } failed_lines{ reason } }
    }`, { i: { lines: [{ offer_id: offer.id, package_id: null, order_hash: line.order_hash }], signed_convert: signed } })
    expect(co.marketplaceCheckoutCart.fully_completed, JSON.stringify(co.marketplaceCheckoutCart.failed_lines)).toBe(true)

    const orderOps = await waitForOps(chairmanToken, line.order_hash, ['o.mkt.conv', 'o.mkt.fee'])
    expect(amount(orderOps.find(r => r.operationCode === 'o.mkt.conv')!.quantity), 'переведена ровно членская часть, и перевод — в нитке заказа').toBeCloseTo(amount(preview.convert.membership_fee), 2)
    expect(await historyOfProcess(chairmanToken, preview.convert.document.hash), 'отдельной нитки по хешу заявления быть не должно').toEqual([])
    expect(sumOf(orderOps, 'o.mkt.lock') + sumOf(orderOps, 'o.mkt.lockp'), 'тело целиком паевым резервом из двух паевых кошельков').toBeCloseTo(amount(line.amount) - amount(line.membership_fee), 2)
    expect(sumOf(orderOps, 'o.mkt.lockp'), 'свободный паевой программы идёт на тело в первую очередь').toBeCloseTo(amount(line.from_program), 2)
    expect(amount(orderOps.find(r => r.operationCode === 'o.mkt.fee')!.quantity), 'взнос целиком с членского кошелька').toBeCloseTo(amount(line.membership_fee), 2)
  }, 300_000)

  it('mkt.stock.side.08: заказ из остатка без покрытого взноса отвергается так же, как обычный', async () => {
    // Пайщица только что выбрала членский кошелёк до нуля; свободный паевой
    // Стола заказов у неё может быть — но взнос идёт только с членского.
    const stock: any = await gqlAs(ekaterinaToken, `query($i:MarketplaceListAllOffersInput){
      marketplaceListAllOffers(input:$i){ items { id status supplier_account stock_braname price_per_unit } }
    }`, { i: {} })
    const stockOffer = (stock.marketplaceListAllOffers.items as any[]).find(o => o.status === 'ACTIVE' && o.stock_braname === BRANAME)
    if (!stockOffer) {
      console.warn('на стенде нет опубликованного остатка склада на КУ — контрактная проверка stockorder пропущена')
      return
    }
    const orderHash = sha256Hex(`stock08|${Date.now()}`)
    await expect(bc.transactWithLogs([{
      account: 'marketplace',
      name: 'stockorder',
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        orderer: ekaterina.account,
        order_hash: orderHash,
        offer_hash: sha256Hex(`offer:${stockOffer.id}`),
        delivery_braname: BRANAME,
        quantity: '1.000 PCS',
        unit_price: `${amount(stockOffer.price_per_unit).toFixed(4)} RUB`,
        package_size: '0.000 PCS',
        warranty_period_secs: 0,
        batch_hash: '0'.repeat(64),
      },
    }])).rejects.toThrow(/Недостаточно членских средств Стола заказов на членский взнос/)
  }, 120_000)
})
