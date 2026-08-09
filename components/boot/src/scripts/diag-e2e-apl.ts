/**
 * E2E-валидация канона двухподписного АПП приёмки (шаги 4→7 магистрали II)
 * на СВЕЖЕМ заказе — без UI, без чтения цепи, всё через backend GraphQL.
 * Проверяет именно новую ручку: marketplaceAplReceptionChairmanSignablePayloads
 * отдаёт DocumentAggregate (rawDocument + document с подписью поставщика),
 * председатель накладывает 2-ю подпись (Capital-паттерн).
 *
 * Шаги:
 *   1. ivanpetrov (offerer): marketplaceAcceptIndividualOrder → авто-Shipment.
 *   2. ivanpetrov: marketplaceListShipments(SUPPLY_PREPARED) → берём свежую.
 *   3. chairkrg (operator КУ): marketplaceCreateAplReception → APL.
 *   4. ivanpetrov: supplier payloads → signDocument(id=1) → signAsSupplier.
 *   5. chairkrg: chairman payloads (DocumentAggregate) →
 *      signDocument(rawDocument, chairkrg, 2, [document]) → signAsChairman.
 *
 * Запуск (mono-ai-4):
 *   API_URL=http://127.0.0.1:3028/v1/graphql CHAIN_URL=http://127.0.0.1:8918 \
 *   ORDER_ID=39578e30-2bb4-4495-836b-c91c89eb744f \
 *     pnpm --filter @coopenomics/boot exec esno src/scripts/diag-e2e-apl.ts
 */
import ecc from 'eosjs-ecc'
import { Classes } from '@coopenomics/sdk'

const API_URL = process.env.API_URL || 'http://127.0.0.1:3028/v1/graphql'
const CHAIN_URL = process.env.CHAIN_URL || 'http://127.0.0.1:8918'
// individual-оффер «Мёд алтайский» ivanpetrov (cycle_type=individual) + ПВЗ krg.
const OFFER_ID = process.env.OFFER_ID || '670c87d3-4e55-474e-a4e3-646c9ff0a4cd'
const BRANAME = process.env.BRANAME || 'krg'

const SUPPLIER = { email: 'ivan.petrov@example.com', wif: '5JL7fbB6kqsmk38zns2NMqqs5sWUojNGNhoAgE5G4fxXw5Uz733', account: 'ivanpetrov' }
const CHAIR = { email: 'chairkrg@voskhod.coop', wif: '5KN4NRRdqNG9SH7sLP9pA87zvRSWmCR3a43mTHXbi7SwDTietBL', account: 'chairkrg' }
const ORDERER = { email: 'ekaterina.smirnova@example.com', wif: '5KXg5ZDL7yu34gYSxzL7XKeePsY2Y2wN63WEYoWNzDwoMUihWG9', account: 'ekaterina' }

async function gql(token: string | null, query: string, variables?: any): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(API_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) })
  const payload: any = await res.json()
  if (payload.errors) throw new Error('gql: ' + JSON.stringify(payload.errors))
  return payload.data
}

async function login(who: { email: string; wif: string; account: string }): Promise<string> {
  const info = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
  const now = info.head_block_time
  const digest = ecc.sha256(Buffer.from(now, 'utf8'), 'hex')
  const signature = ecc.signHash(digest, who.wif)
  const m = `mutation($d:LoginInput!){ login(data:$d){ tokens{ access{ token } } account{ username } } }`
  const d = await gql(null, m, { d: { email: who.email, now, signature } })
  console.error('[e2e] login', d.login.account.username)
  return d.login.tokens.access.token
}

async function main() {
  // 0. orderer (ekaterina) оформляет СВЕЖИЙ individual-заказ — backend-хук
  //    сразу переводит ACTIVE → ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL, и мы
  //    принимаем его тут же, не давая race #151 откатить статус.
  const ordTok = await login(ORDERER)
  const created = await gql(ordTok, `mutation($i:MarketplaceCreateOrderInput!){ marketplaceCreateOrder(input:$i){ order{ id status } } }`, { i: { offer_id: OFFER_ID, quantity: 1, delivery_braname: BRANAME } })
  const ORDER_ID = created.marketplaceCreateOrder.order.id as string
  console.error('[e2e] order created:', ORDER_ID, created.marketplaceCreateOrder.order.status)

  // 1. accept individual order (offerer) → авто-Shipment
  const supTok = await login(SUPPLIER)
  const acc = await gql(supTok, `mutation($i:MarketplaceAcceptIndividualOrderInput!){ marketplaceAcceptIndividualOrder(input:$i){ order{ id status } tx_hash } }`, { i: { order_id: ORDER_ID } })
  console.error('[e2e] accepted:', JSON.stringify(acc.marketplaceAcceptIndividualOrder))

  // 2. найти свежую партию SUPPLY_PREPARED именно по нашему заказу (через cycle_id)
  const acceptedOrder = acc.marketplaceAcceptIndividualOrder.order
  const ordInfo = await gql(supTok, `query($d:MarketplaceGetOrderInput!){ marketplaceGetOrder(data:$d){ id status cycle_id } }`, { d: { order_id: ORDER_ID } }).catch(() => null)
  const ourCycleId = ordInfo?.marketplaceGetOrder?.cycle_id ?? null
  console.error('[e2e] accepted order:', JSON.stringify(acceptedOrder), 'cycle_id:', ourCycleId)
  const sh = await gql(supTok, `query($d:MarketplaceListShipmentsInput){ marketplaceListShipments(data:$d){ id status braname cycle_id } }`, { d: { statuses: ['SUPPLY_PREPARED'] } })
  const shipments = sh.marketplaceListShipments as any[]
  console.error('[e2e] SUPPLY_PREPARED shipments:', JSON.stringify(shipments))
  const shipment = (ourCycleId && shipments.find((s) => s.cycle_id === ourCycleId)) || shipments[0]
  if (!shipment) throw new Error('Нет SUPPLY_PREPARED партии после accept')

  if (Number(process.env.STOP_AFTER) === 2) {
    console.error(`[e2e] STOP_AFTER=2 — SHIPMENT ${shipment.id} в SUPPLY_PREPARED (готов к маркировке EAN-13), ORDER ${ORDER_ID}`)
    return
  }

  // 3. оператор КУ создаёт АПП
  const chairTok = await login(CHAIR)
  const cr = await gql(chairTok, `mutation($d:MarketplaceCreateAplReceptionInput!){ marketplaceCreateAplReception(data:$d){ apl_reception{ id status braname } } }`, { d: { shipment_id: shipment.id } })
  const aplId = cr.marketplaceCreateAplReception.apl_reception.id
  console.error('[e2e] APL создан:', aplId, cr.marketplaceCreateAplReception.apl_reception.status)

  if (Number(process.env.STOP_AFTER) === 5) {
    console.error(`[e2e] STOP_AFTER=5 — APL ${aplId} в PENDING_SUPPLIER_SIGN (ждёт подпись поставщика), ORDER ${ORDER_ID}`)
    return
  }

  // 4. поставщик подписывает (id=1) — backend сохранит supplier_signed_documents + тело (skip_save:false)
  const supTok2 = await login(SUPPLIER)
  const sp = await gql(supTok2, `query($d:MarketplaceAplReceptionByIdInput!){ marketplaceAplReceptionSupplierSignablePayloads(data:$d){ full_title hash meta binary } }`, { d: { apl_reception_id: aplId } })
  const supPayloads = sp.marketplaceAplReceptionSupplierSignablePayloads as any[]
  const supSigner = new Classes.Document(SUPPLIER.wif)
  const supplierSigned: any[] = []
  for (const p of supPayloads) supplierSigned.push(await supSigner.signDocument(p, SUPPLIER.account, 1))
  const ss = await gql(supTok2, `mutation($d:MarketplaceSignAplReceptionInput!){ marketplaceSignAplReceptionAsSupplier(data:$d){ apl_reception{ id status supplier_signed_at } } }`, { d: { apl_reception_id: aplId, signed_documents: supplierSigned } })
  console.error('[e2e] supplier sign OK:', JSON.stringify(ss.marketplaceSignAplReceptionAsSupplier))

  if (Number(process.env.STOP_AFTER) === 6) {
    console.error(`[e2e] STOP_AFTER=6 — APL ${aplId} в PENDING_CHAIRMAN_RECEPTION_SIGN (ждёт закрывающую подпись председателя), ORDER ${ORDER_ID}`)
    return
  }

  // 5. председатель: новая ручка DocumentAggregate → подпись id=2 поверх подписи поставщика
  const chairTok2 = await login(CHAIR)
  const cp = await gql(chairTok2, `query($d:MarketplaceAplReceptionByIdInput!){ marketplaceAplReceptionChairmanSignablePayloads(data:$d){ hash rawDocument{ full_title html hash meta binary } document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } } } }`, { d: { apl_reception_id: aplId } })
  const chairPayloads = cp.marketplaceAplReceptionChairmanSignablePayloads as any[]
  console.error('[e2e] chairman aggregates:', chairPayloads.length, 'supplier sig:', JSON.stringify(chairPayloads[0]?.document?.signatures?.map((s: any) => `${s.id}:${s.signer}`)))
  const chairSigner = new Classes.Document(CHAIR.wif)
  const chairSigned: any[] = []
  for (const p of chairPayloads) {
    const signed = await chairSigner.signDocument(p.rawDocument, CHAIR.account, 2, [p.document])
    console.error('[e2e]   order', p.rawDocument?.meta?.order_id, 'sigs:', signed.signatures.map((s: any) => `${s.id}:${s.signer}`).join(','))
    chairSigned.push(signed)
  }
  const cs = await gql(chairTok2, `mutation($d:MarketplaceSignAplReceptionInput!){ marketplaceSignAplReceptionAsChairman(data:$d){ apl_reception{ id status chairman_signed_at chairman_account chairman_signchair_tx_hash } } }`, { d: { apl_reception_id: aplId, signed_documents: chairSigned } })
  console.error('[e2e] CHAIRMAN SIGN OK:', JSON.stringify(cs.marketplaceSignAplReceptionAsChairman))

  // ── Магистраль II шаг 8: оператор КУ маркирует имущество EAN-13 ───────
  // переиспользуем токен председателя: повторный login того же аккаунта в
  // пределах одного блока даёт одинаковый now → одинаковую подпись → дубль
  // токена сессии (UQ constraint).
  const lbl = await gql(chairTok2, `mutation($d:MarketplaceLabelInventoryInput!){ marketplaceLabelInventory(data:$d){ inventory{ id barcode_value barcode_format quantity_per_label status product_name_snapshot } } }`, { d: { order_id: ORDER_ID, format: 'EAN13' } })
  console.error('[e2e] LABEL OK (EAN-13):', JSON.stringify(lbl.marketplaceLabelInventory.inventory?.map((i: any) => `${i.barcode_value}/${i.barcode_format}/${i.status}`)))

  // ── Магистраль II шаги 9-10: ВЫДАЧА (тот же двухподписный канон) ──────
  // 9. председатель КУ выдачи открывает выдачу первой подписью (signiss1).
  const oip = await gql(chairTok2, `query($d:MarketplaceIssueActPayloadInput!){ marketplaceIssueActChairmanSignablePayload(data:$d){ full_title hash meta binary } }`, { d: { order_id: ORDER_ID } })
  const openPayload = oip.marketplaceIssueActChairmanSignablePayload
  const chairIssSigner = new Classes.Document(CHAIR.wif)
  const chairIssSigned = await chairIssSigner.signDocument(openPayload, CHAIR.account, 1)
  const oi = await gql(chairTok2, `mutation($d:MarketplaceOpenIssuanceInput!){ marketplaceOpenIssuance(data:$d){ order{ id status } tx_hash } }`, { d: { order_id: ORDER_ID, signed_document: chairIssSigned } })
  console.error('[e2e] OPEN ISSUANCE OK (signiss1):', JSON.stringify(oi.marketplaceOpenIssuance))

  if (Number(process.env.STOP_AFTER) === 9) {
    console.error(`[e2e] STOP_AFTER=9 — ORDER ${ORDER_ID} в READY_TO_RECEIVE (ждёт финальную подпись заказчика)`)
    return
  }

  // 10. заказчик получает DocumentAggregate (подписанный председателем) и
  //     накладывает 2-ю подпись поверх → финальная подпись (signiss2).
  const ordTok2 = await login(ORDERER)
  const fp = await gql(ordTok2, `query($d:MarketplaceIssueActPayloadInput!){ marketplaceIssueActOrdererSignablePayload(data:$d){ hash rawDocument{ full_title html hash meta binary } document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } } } }`, { d: { order_id: ORDER_ID } })
  const finAgg = fp.marketplaceIssueActOrdererSignablePayload
  console.error('[e2e] issuance aggregate — chairman sig:', JSON.stringify(finAgg?.document?.signatures?.map((s: any) => `${s.id}:${s.signer}`)))
  const ordSigner = new Classes.Document(ORDERER.wif)
  const finSigned = await ordSigner.signDocument(finAgg.rawDocument, ORDERER.account, 2, [finAgg.document])
  console.error('[e2e]   issuance sigs:', finSigned.signatures.map((s: any) => `${s.id}:${s.signer}`).join(','))
  const fi = await gql(ordTok2, `mutation($d:MarketplaceFinalizeIssuanceInput!){ marketplaceFinalizeIssuance(data:$d){ order{ id status received_at } tx_hash } }`, { d: { order_id: ORDER_ID, actual_quantity: 1, delivery_signer: CHAIR.account, signed_document: finSigned } })
  console.error('[e2e] FINALIZE ISSUANCE OK (signiss2):', JSON.stringify(fi.marketplaceFinalizeIssuance))
}

main().then(() => process.exit(0)).catch((e) => { console.error('[e2e] FAILED:', e.message ?? e); process.exit(1) })
