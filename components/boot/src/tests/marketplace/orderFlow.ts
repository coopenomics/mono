/**
 * Шаги живой цепочки заказа Стола заказов, общие для контрактных тестов
 * денежных мест (задача 598-51): оформление через корзину, экспресс-приёмка на
 * ПВЗ и выдача бандлом.
 *
 * Здесь только ДЕЙСТВИЯ — ни одного ассерта об учёте: проверки проводок живут
 * в самих тестах, иначе «денежное место проверено» означало бы «хелпер сам себя
 * проверил». Шаги повторяют путь desktop'а один в один, включая двухподписные
 * акты (первая подпись id=1, вторая — id=2 поверх агрегата).
 */
import { gqlAs, signAs, type Who } from './chainHelpers'

export interface OfferLike {
  id: string
  product_name: string
  price_per_unit: string
  supplier_account: string
}

/** Активное предложение поставщика с доставкой на нужный КУ. */
export async function pickOffer(
  token: string,
  supplierAccount: string,
  braname: string,
  preferName?: string,
): Promise<OfferLike> {
  const d: any = await gqlAs(token, `query($i:MarketplaceListAllOffersInput){
    marketplaceListAllOffers(input:$i){ items {
      id product_name status supplier_account price_per_unit unit_of_measure warranty_days
      delivery_points { braname min_supply_volume }
    } }
  }`, { i: {} })
  const candidates = (d.marketplaceListAllOffers.items as any[]).filter(
    o => o.status === 'ACTIVE'
      && o.supplier_account === supplierAccount
      && o.delivery_points.some((p: any) => p.braname === braname),
  )
  const offer = (preferName && candidates.find(o => o.product_name === preferName)) || candidates[0]
  if (!offer) throw new Error(`на стенде нет активного предложения ${supplierAccount} с поставкой на КУ «${braname}»`)
  return offer
}

/**
 * Оформление заказа пайщиком: корзина → подпись Заявления о конвертации
 * паевого взноса по позиции → оформление корзины.
 */
export async function placeOrder(args: {
  token: string
  who: Who
  offerId: string
  quantity: number
  braname: string
}): Promise<{ orderId: string, orderHash: string }> {
  const { token, who, offerId, quantity, braname } = args

  await gqlAs(token, 'mutation{ marketplaceClearCart{ __typename } }').catch(() => {})
  await gqlAs(token, 'mutation($i:MarketplaceAddToCartInput!){ marketplaceAddToCart(input:$i){ __typename } }', {
    i: { offer_id: offerId, quantity, delivery_braname: braname },
  })

  const sp: any = await gqlAs(token, `query{
    marketplaceCheckoutSignablePayloads{ offer_id package_id order_hash amount document{ full_title html hash meta binary } }
  }`)
  const payloads = sp.marketplaceCheckoutSignablePayloads as any[]
  if (!payloads.length) throw new Error('по позиции корзины не пришло заявление к подписи')

  const lines: any[] = []
  for (const p of payloads) {
    lines.push({
      offer_id: p.offer_id,
      package_id: p.package_id,
      order_hash: p.order_hash,
      signed_statement: await signAs(who.wif, p.document, who.account, 1),
    })
  }

  const co: any = await gqlAs(token, `mutation($i:MarketplaceCheckoutCartInput){
    marketplaceCheckoutCart(input:$i){ fully_completed created_orders{ id status } failed_lines{ reason } }
  }`, { i: { lines } })
  const result = co.marketplaceCheckoutCart
  if (!result.fully_completed) throw new Error(`оформление не прошло целиком: ${JSON.stringify(result.failed_lines)}`)

  const orderId = result.created_orders[0].id as string
  const ord: any = await gqlAs(token, 'query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ id order_hash } }', {
    i: { order_id: orderId },
  })
  return { orderId, orderHash: ord.marketplaceGetOrder.order_hash as string }
}

/**
 * Приёмка имущества кооперативом: поставщик акцептует заявку, оператор ПВЗ
 * оформляет экспресс-приёмку (партия по накопительным предложениям сида сама
 * не собирается), затем двухподписный АПП — поставщик и председатель КУ.
 *
 * Факт задаётся явно, чтобы цена прибытия была детерминированной.
 */
export async function acceptToCoop(args: {
  supplierToken: string
  supplier: Who
  operatorToken: string
  operator: Who
  orderId: string
  braname: string
  factQuantity: number
  factUnitPrice: number
}): Promise<{ aplId: string, txHash: string }> {
  const { supplierToken, supplier, operatorToken, operator, orderId, braname, factQuantity, factUnitPrice } = args

  await gqlAs(supplierToken, 'mutation($i:MarketplaceAcceptOrdersBatchInput!){ marketplaceAcceptOrdersBatch(input:$i){ __typename } }', {
    i: { order_ids: [orderId] },
  })

  const ex: any = await gqlAs(operatorToken, `mutation($d:MarketplaceCreateExpressReceptionInput!){
    marketplaceCreateExpressReception(data:$d){ apl_receptions{ id status fact_quantity_per_order{ order_id fact_quantity fact_unit_price } } }
  }`, {
    d: {
      braname,
      offerer_account: supplier.account,
      fact_quantity_per_order: [{ order_id: orderId, fact_quantity: factQuantity, fact_unit_price: factUnitPrice.toFixed(4) }],
    },
  })
  const receptions = ex.marketplaceCreateExpressReception.apl_receptions as any[]
  // Экспресс-приёмка забирает все ожидающие заявки поставщика на этом КУ —
  // берём акт, в котором лежит нужный заказ.
  const apl = receptions.find(r => r.fact_quantity_per_order.some((f: any) => f.order_id === orderId))
  if (!apl) throw new Error('экспресс-приёмка не включила заказ')

  const sp: any = await gqlAs(supplierToken, `query($d:MarketplaceAplReceptionByIdInput!){
    marketplaceAplReceptionSupplierSignablePayloads(data:$d){ full_title html hash meta binary }
  }`, { d: { apl_reception_id: apl.id } })
  const supplierSigned: any[] = []
  for (const p of sp.marketplaceAplReceptionSupplierSignablePayloads) {
    supplierSigned.push(await signAs(supplier.wif, p, supplier.account, 1))
  }
  await gqlAs(supplierToken, `mutation($d:MarketplaceSignAplReceptionInput!){
    marketplaceSignAplReceptionAsSupplier(data:$d){ apl_reception{ id status } }
  }`, { d: { apl_reception_id: apl.id, signed_documents: supplierSigned } })

  const cp: any = await gqlAs(operatorToken, `query($d:MarketplaceAplReceptionByIdInput!){
    marketplaceAplReceptionChairmanSignablePayloads(data:$d){
      hash
      rawDocument{ full_title html hash meta binary }
      document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }
    }
  }`, { d: { apl_reception_id: apl.id } })
  const chairSigned: any[] = []
  for (const p of cp.marketplaceAplReceptionChairmanSignablePayloads) {
    chairSigned.push(await signAs(operator.wif, p.rawDocument, operator.account, 2, [p.document]))
  }
  const cs: any = await gqlAs(operatorToken, `mutation($d:MarketplaceSignAplReceptionInput!){
    marketplaceSignAplReceptionAsChairman(data:$d){ apl_reception{ id status chairman_signchair_tx_hash } }
  }`, { d: { apl_reception_id: apl.id, signed_documents: chairSigned } })

  return { aplId: apl.id, txHash: cs.marketplaceSignAplReceptionAsChairman.apl_reception.chairman_signchair_tx_hash }
}

/** Маркировка позиций склада — штатный шаг перед выдачей со стойки. */
export async function labelInventory(operatorToken: string, orderId: string): Promise<void> {
  const inv: any = await gqlAs(operatorToken, `query($d:MarketplaceListInventoryInput){
    marketplaceListInventory(data:$d){ id order_id barcode_value }
  }`, { d: { order_id: orderId } }).catch(() => null)
  for (const item of ((inv?.marketplaceListInventory ?? []) as any[]).filter(i => !i.barcode_value)) {
    await gqlAs(operatorToken, `mutation($d:MarketplaceGenerateInventoryLabelInput!){
      marketplaceGenerateInventoryLabel(data:$d){ __typename }
    }`, { d: { inventory_id: item.id, format: 'EAN13' } }).catch(() => {})
  }
}

/**
 * Выдача заказа единым бандлом: оператор подписывает АПП-выдачи (signiss1) и
 * кладёт его в предложение, пайщик контрподписывает (signiss2) — только тогда
 * связка уходит на цепь.
 */
export async function issueOrder(args: {
  operatorToken: string
  operator: Who
  memberToken: string
  member: Who
  orderId: string
  braname: string
  actualQuantity: number
  actualUnitPrice: number
}): Promise<{ proposalId: string, convertRequired: boolean, orderIds: string[] }> {
  const { operatorToken, operator, memberToken, member, orderId, braname, actualQuantity, actualUnitPrice } = args

  await labelInventory(operatorToken, orderId)

  const op: any = await gqlAs(operatorToken, `query($d:MarketplaceIssueActPayloadInput!){
    marketplaceIssueActChairmanSignablePayload(data:$d){ full_title html hash meta binary }
  }`, { d: { order_id: orderId, actual_quantity: actualQuantity, actual_unit_price: actualUnitPrice.toFixed(4) } })
  const signiss1 = await signAs(operator.wif, op.marketplaceIssueActChairmanSignablePayload, operator.account, 1)

  const prop: any = await gqlAs(operatorToken, `mutation($d:MarketplaceCreateStockProposalInput!){
    marketplaceCreateStockProposal(data:$d){ id status member_account braname total_cost }
  }`, {
    d: {
      braname,
      member_account: member.account,
      order_items: [{
        order_id: orderId,
        actual_quantity: actualQuantity,
        actual_unit_price: actualUnitPrice.toFixed(4),
        signiss1_act: signiss1,
      }],
    },
  })
  const proposalId = prop.marketplaceCreateStockProposal.id as string

  const pay: any = await gqlAs(memberToken, `query($d:MarketplaceResolveStockProposalInput!){
    marketplaceStockProposalSignablePayloads(data:$d){
      convert_amount member_amount
      convert_document{ full_title html hash meta binary }
      order_lines{
        order_hash
        signiss1_aggregate{
          hash
          rawDocument{ full_title html hash meta binary }
          document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }
        }
      }
    }
  }`, { d: { proposal_id: proposalId } })
  const accept = pay.marketplaceStockProposalSignablePayloads

  const orderLines: any[] = []
  for (const l of accept.order_lines as any[]) {
    orderLines.push({
      order_hash: l.order_hash,
      signed_signiss2_act: await signAs(
        member.wif, l.signiss1_aggregate.rawDocument, member.account, 2, [l.signiss1_aggregate.document],
      ),
    })
  }

  const signedConvert = accept.convert_document
    ? await signAs(member.wif, accept.convert_document, member.account, 1)
    : null

  const fin: any = await gqlAs(memberToken, `mutation($d:MarketplaceFinalizeStockIssuanceInput!){
    marketplaceFinalizeStockIssuance(data:$d){ proposal{ id status } order_ids }
  }`, { d: { proposal_id: proposalId, order_lines: orderLines, signed_convert: signedConvert } })

  return {
    proposalId,
    convertRequired: Boolean(accept.convert_document),
    orderIds: fin.marketplaceFinalizeStockIssuance.order_ids as string[],
  }
}
