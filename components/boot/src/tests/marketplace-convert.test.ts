/**
 * Заявление 1110 и внутренний членский кошелёк Стола заказов — денежные места
 * паевой модели по уточнению владельца 06.09.2026 (реестр: mkt.order.side.33,
 * mkt.order.side.34, mkt.stock.side.08):
 *   • createorder без подготовленного членского кошелька (взнос не покрыт) —
 *     контракт отвергает с подсказкой подать заявление; средств не трогает;
 *   • перевод по заявлению (convert) кладёт на членский кошелёк ровно членскую
 *     часть, после чего тот же createorder проходит;
 *   • если членского кошелька хватает на весь заказ, превью не приносит
 *     заявления, а заказ ложится членским резервом (o.mkt.lockm) без o.mkt.lock;
 *   • stockorder без покрытого взноса отвергается так же, как createorder.
 *
 * Живой стенд с сидом docs-harness (фикстуры пайщиков в state/). Контрактные
 * шаги идут напрямую в цепь ключом кооператива (как это делает бэкенд).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { pickOffer, placeOrder } from './marketplace/orderFlow'
import { amount, ensureShareFunds, fromState, gqlAs, historyOfProcess, loginAs, signAs, waitForOps } from './marketplace/chainHelpers'

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
    // Опустошаем членский кошелёк оформлением: превью само посчитает, сколько
    // перевести; после заказа остаток кошелька нулевой (тело добирает всё).
    await placeOrder({ token: ekaterinaToken, who: ekaterina, offerId: offer.id, quantity: 1, braname: BRANAME })
    const left = await memberAvailable(ekaterinaToken)
    expect(left, 'после заказа членский кошелёк выбран до нуля — тело добирает остаток').toBeLessThan(0.005)

    const orderHash = sha256Hex(`side33|${Date.now()}`)
    await expect(createOrderDirect(orderHash, 1)).rejects.toThrow(/Недостаточно членских средств Стола заказов на членский взнос/)
    const rows = await historyOfProcess(chairmanToken, orderHash).catch(() => [])
    expect(rows.length, 'отвергнутый заказ не оставляет движений').toBe(0)
  }, 300_000)

  it('mkt.order.side.34: перевод по заявлению кладёт на членский кошелёк ровно членскую часть, после чего заказ проходит', async () => {
    // Превью: членского кошелька нет — заявление на недостающую сумму.
    await gqlAs(ekaterinaToken, 'mutation{ marketplaceClearCart{ __typename } }').catch(() => {})
    await gqlAs(ekaterinaToken, 'mutation($i:MarketplaceAddToCartInput!){ marketplaceAddToCart(input:$i){ __typename } }', {
      i: { offer_id: offer.id, quantity: 1, delivery_braname: BRANAME },
    })
    const sp: any = await gqlAs(ekaterinaToken, `query{
      marketplaceCheckoutSignablePayloads{
        lines{ order_hash amount membership_fee from_member from_share }
        convert{ amount membership_fee document{ full_title html hash meta binary } }
      }
    }`)
    const preview = sp.marketplaceCheckoutSignablePayloads
    expect(preview.convert, 'при пустом членском кошельке превью обязано принести заявление').toBeTruthy()
    const line = preview.lines[0]
    expect(amount(preview.convert.amount), 'заявление — на недостающую сумму: тело с паевого и членская часть').toBeCloseTo(amount(line.from_share) + amount(preview.convert.membership_fee), 2)
    expect(amount(preview.convert.membership_fee), 'членская часть равна взносу, кошелёк пуст').toBeCloseTo(amount(line.membership_fee), 2)
    const meta = JSON.parse(preview.convert.document.meta)
    expect(meta.registry_id).toBe(1110)
    expect(preview.convert.document.html, 'текст заявления — слова владельца').toMatch(/Прошу перевести с баланса моего Цифрового кошелька/)
    expect(preview.convert.document.html).not.toMatch(/ставк|зачит/i)

    // Оформление: перевод отдельной ниткой (хеш заявления), затем заказ.
    const signed = await signAs(ekaterina.wif, preview.convert.document, ekaterina.account, 1)
    const co: any = await gqlAs(ekaterinaToken, `mutation($i:MarketplaceCheckoutCartInput){
      marketplaceCheckoutCart(input:$i){ fully_completed created_orders{ id order_hash } failed_lines{ reason } }
    }`, { i: { lines: [{ offer_id: offer.id, package_id: null, order_hash: line.order_hash }], signed_convert: signed } })
    expect(co.marketplaceCheckoutCart.fully_completed, JSON.stringify(co.marketplaceCheckoutCart.failed_lines)).toBe(true)

    const convOps = await waitForOps(chairmanToken, preview.convert.document.hash, ['o.mkt.conv'])
    expect(amount(convOps.find(r => r.operationCode === 'o.mkt.conv')!.quantity), 'переведена ровно членская часть').toBeCloseTo(amount(preview.convert.membership_fee), 2)
    const orderOps = await waitForOps(chairmanToken, line.order_hash, ['o.mkt.fee', 'o.mkt.lock'])
    expect(orderOps.some(r => r.operationCode === 'o.mkt.lockm'), 'при пустом кошельке членского резерва нет').toBe(false)
    expect(amount(orderOps.find(r => r.operationCode === 'o.mkt.lock')!.quantity)).toBeCloseTo(amount(line.from_share), 2)
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
