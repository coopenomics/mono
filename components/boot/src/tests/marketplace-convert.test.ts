/**
 * Заявление 1110 о трансляции паевого взноса и обеспечительная часть Стола
 * заказов (задача 99D-18; реестр: mkt.order.side.33, mkt.order.side.34,
 * mkt.stock.side.08):
 *   • createorder, когда свободного паевого Стола заказов не хватает на
 *     обеспечительную часть, — контракт отвергает с кодом
 *     MARKETPLACE_SECURE_PART_SHORTFALL; средств не трогает;
 *   • трансляция по заявлению (convert) кладёт на свободный паевой ровно сумму
 *     заявления, после чего заказ проходит; трансляция адресована заказу и идёт
 *     первой операцией его нитки, без проводки;
 *   • со свободного паевого сначала обеспечительная часть (o.mkt.fee), затем
 *     тело (o.mkt.lockp);
 *   • stockorder без покрытой обеспечительной части отвергается так же.
 *
 * Живой стенд с сидом docs-harness (фикстуры пайщиков в state/). Контрактные
 * шаги идут напрямую в цепь ключом кооператива (как это делает бэкенд).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { pickOffer, placeOrder } from './marketplace/orderFlow'
import { CHAIRMAN, amount, ensureShareFunds, fromState, gqlAs, historyOfProcess, loginAs, signAs, sumOf, waitForOps, docMeta, unitAsset } from './marketplace/chainHelpers'

const BRANAME = 'krg'
const COOPNAME = 'voskhod'

const sidorov = fromState('sidorov')
const ekaterina = fromState('ekaterina')
// Председатель кооператива стенда — канон chainHelpers (как в соседних наборах);
// файла ant.json docs-harness не создаёт, на dev-стенде его клали руками.
const chairman = CHAIRMAN

const bc = new Blockchain(config.network, config.private_keys)

let ekaterinaToken = ''
let chairmanToken = ''
let offer: any
let unitPrice = 0

function sha256Hex(s: string): string {
  return require('node:crypto').createHash('sha256').update(s).digest('hex')
}

async function freeShareAvailable(token: string): Promise<number> {
  const d: any = await gqlAs(token, 'query{ marketplaceMemberWallet{ wallets{ name available } } }').catch(() => null)
  const row = d?.marketplaceMemberWallet?.wallets?.find((w: any) => w.name === 'w.mkt.share')
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
      quantity: unitAsset(offer.unit_of_measure, quantity),
      unit_price: `${unitPrice.toFixed(4)} RUB`,
      package_size: unitAsset(offer.unit_of_measure, 0),
      warranty_period_secs: 0,
      batch_hash: '0'.repeat(64),
    },
  }])
}

describe('Стол заказов: заявление 1110 о трансляции и обеспечительная часть', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    ekaterinaToken = await loginAs(ekaterina)
    chairmanToken = await loginAs(chairman)
    // Весь список предложений — право администратора Стола заказов
    // (Offer:read:all); покупатель видит только витрину.
    offer = await pickOffer(chairmanToken, sidorov.account, BRANAME, 'Мёд цветочный')
    unitPrice = amount(offer.price_per_unit)
    await ensureShareFunds(ekaterina.account, unitPrice * 6, ekaterinaToken)
  }, 180_000)

  it('mkt.order.side.33: createorder без покрытой свободным паевым обеспечительной части отвергается — контракт велит сначала подать заявление', async () => {
    // Опустошаем свободный паевой оформлениями: превью транслирует ровно
    // недостающее, заказ берёт со свободного паевого обеспечительную часть и тело.
    let left = await freeShareAvailable(ekaterinaToken)
    for (let i = 0; i < 6 && left >= unitPrice * 0.3 - 0.005; i++) {
      await placeOrder({ token: ekaterinaToken, who: ekaterina, offerId: offer.id, quantity: 1, braname: BRANAME })
      left = await freeShareAvailable(ekaterinaToken)
    }
    expect(left, 'свободного паевого на обеспечительную часть очередного заказа не хватает').toBeLessThan(unitPrice * 0.3 - 0.005)

    const orderHash = sha256Hex(`side33|${Date.now()}`)
    await expect(createOrderDirect(orderHash, 1)).rejects.toThrow(/MARKETPLACE_SECURE_PART_SHORTFALL/)
    const rows = await historyOfProcess(chairmanToken, orderHash).catch(() => [])
    expect(rows.length, 'отвергнутый заказ не оставляет движений').toBe(0)
  }, 300_000)

  it('mkt.order.side.34: трансляция по заявлению кладёт на свободный паевой ровно сумму заявления, после чего заказ проходит', async () => {
    // Превью: свободного паевого не хватает — заявление на недостающее.
    await gqlAs(ekaterinaToken, 'mutation{ marketplaceClearCart{ __typename } }').catch(() => {})
    await gqlAs(ekaterinaToken, 'mutation($i:MarketplaceAddToCartInput!){ marketplaceAddToCart(input:$i){ __typename } }', {
      i: { offer_id: offer.id, quantity: 1, delivery_braname: BRANAME },
    })
    const sp: any = await gqlAs(ekaterinaToken, `query{
      marketplaceCheckoutSignablePayloads{
        lines{ order_hash amount membership_fee from_program from_wallet }
        convert{ amount membership_fee document{ full_title html hash meta binary } }
      }
    }`)
    const preview = sp.marketplaceCheckoutSignablePayloads
    expect(preview.convert, 'свободного паевого не хватает — превью обязано принести заявление').toBeTruthy()
    const line = preview.lines[0]
    expect(amount(preview.convert.amount), 'заявление — только на то, чего не хватило на свободном паевом').toBeCloseTo(amount(line.from_wallet), 2)
    expect(amount(line.from_program) + amount(line.from_wallet), 'стоимость и обеспечительная часть покрыты целиком').toBeCloseTo(amount(line.amount), 2)
    const meta = docMeta(preview.convert.document.meta)
    expect(meta.registry_id).toBe(1110)
    expect(preview.convert.document.html, 'текст заявления — слова владельца').toMatch(/Прошу транслировать мой паевой взнос/)
    expect(preview.convert.document.html).not.toMatch(/членск|ставк|зачит/i)

    // Оформление: перевод адресован заказу и ложится в его нитку, затем заказ.
    const signed = await signAs(ekaterina.wif, preview.convert.document, ekaterina.account, 1)
    const co: any = await gqlAs(ekaterinaToken, `mutation($i:MarketplaceCheckoutCartInput){
      marketplaceCheckoutCart(input:$i){ fully_completed created_orders{ id order_hash } failed_lines{ reason } }
    }`, { i: { lines: [{ offer_id: offer.id, package_id: null, order_hash: line.order_hash }], signed_convert: signed } })
    expect(co.marketplaceCheckoutCart.fully_completed, JSON.stringify(co.marketplaceCheckoutCart.failed_lines)).toBe(true)

    const orderOps = await waitForOps(chairmanToken, line.order_hash, ['o.mkt.conv', 'o.mkt.fee'])
    expect(amount(orderOps.find(r => r.operationCode === 'o.mkt.conv')!.quantity), 'транслирована ровно сумма заявления, и трансляция — в нитке заказа').toBeCloseTo(amount(preview.convert.amount), 2)
    expect(await historyOfProcess(chairmanToken, preview.convert.document.hash), 'отдельной нитки по хешу заявления быть не должно').toEqual([])
    expect(sumOf(orderOps, 'o.mkt.lock') + sumOf(orderOps, 'o.mkt.lockp'), 'тело целиком паевым резервом').toBeCloseTo(amount(line.amount) - amount(line.membership_fee), 2)
    expect(sumOf(orderOps, 'o.mkt.lock'), 'после трансляции тело целиком со свободного паевого').toBeCloseTo(0, 2)
    expect(amount(orderOps.find(r => r.operationCode === 'o.mkt.fee')!.quantity), 'обеспечительная часть целиком со свободного паевого').toBeCloseTo(amount(line.membership_fee), 2)
  }, 300_000)

  it('mkt.stock.side.08: заказ из остатка без покрытого взноса отвергается так же, как обычный', async () => {
    // Пайщица только что выбрала свободный паевой до нуля: трансляция под
    // прошлый заказ израсходована на него целиком.
    // Весь список предложений — право администратора Стола заказов (Offer:read:all).
    const stock: any = await gqlAs(chairmanToken, `query($i:MarketplaceListAllOffersInput){
      marketplaceListAllOffers(input:$i){ items { id status supplier_account stock_braname price_per_unit unit_of_measure } }
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
        quantity: unitAsset(stockOffer.unit_of_measure, 1),
        unit_price: `${amount(stockOffer.price_per_unit).toFixed(4)} RUB`,
        package_size: unitAsset(stockOffer.unit_of_measure, 0),
        warranty_period_secs: 0,
        batch_hash: '0'.repeat(64),
      },
    }])).rejects.toThrow(/MARKETPLACE_SECURE_PART_SHORTFALL/)
  }, 120_000)
})
