/**
 * Шаги Стола заказов для внешних тестов: оформление через корзину, приёмка
 * на ПВЗ, выдача, нитки проводок. Здесь только действия и чтение — ассертов
 * об учёте нет: проверки живут в тестах, иначе «место проверено» означало бы
 * «помощник сам себя проверил». Шаги повторяют путь рабочего стола, включая
 * двухподписные акты (первая подпись id=1, вторая — id=2 поверх агрегата).
 *
 * Перенесено из components/boot/src/tests/marketplace (chainHelpers, orderFlow)
 * без зависимостей от внутренностей boot.
 */
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { gql } from '../core/client'
import { signDocument } from '../core/documents'
import { COOP } from '../core/env'
import { CHAIRMAN } from '../core/roles'
import { waitFor } from '../core/wait'

/** КУ стенда: председатель chairkrg, пайщики фикстур привязаны к krg. */
export const KRG = 'krg'

/** Бухсчета в истории ledger2 отдаются умноженными на 1000 (`accountId`). */
export const ACC = { MATERIALS: 10_000, SETTLEMENTS: 76_000, SHARE: 80_000, TARGET: 86_000, OTHER: 91_000, CASH: 51_000 }

// ── Личность и единицы ─────────────────────────────────────────────────────

/**
 * Личность получателя подтверждена — без этого выдача заказа отклоняется
 * (105-28). Подтверждает председатель кооператива без участка; повтор
 * контракт отвергает словами «уже проведена» — это и есть нужное состояние.
 */
export async function ensureIdentityVerified(username: string): Promise<void> {
  try {
    await gql(await tokenOf(CHAIRMAN),
      'mutation($d:VerifyParticipantOnsiteInput!){ verifyParticipantOnsite(data:$d){ type status } }',
      { d: { username } })
  }
  catch (e: any) {
    if (!/уже/i.test(String(e?.message)))
      throw e
  }
}

/**
 * Количество в единице предложения, как его принимает контракт: KG и LTR —
 * три знака, штука PCS неделима — ноль знаков.
 */
const UNIT_ASSET: Record<string, { symbol: string, precision: number }> = {
  KG: { symbol: 'KG', precision: 3 },
  LITER: { symbol: 'LTR', precision: 3 },
  PIECE: { symbol: 'PCS', precision: 0 },
}
export function unitAsset(unitOfMeasure: string, quantity: number): string {
  const u = UNIT_ASSET[unitOfMeasure]
  if (!u)
    throw new Error(`единица предложения ${unitOfMeasure} тесту неизвестна`)
  return `${quantity.toFixed(u.precision)} ${u.symbol}`
}

// ── Предложения и заказ ────────────────────────────────────────────────────

export interface OfferLike {
  id: string
  product_name: string
  price_per_unit: string
  supplier_account: string
  unit_of_measure: string
}

/** Активное предложение поставщика с доставкой на нужный КУ (сид стенда). */
export async function pickOffer(token: string, supplierAccount: string, braname = KRG, preferName?: string): Promise<OfferLike> {
  return waitFor(async () => {
    const d = await gql<any>(token, `query($i:MarketplaceListAllOffersInput){
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
    return (preferName && candidates.find(o => o.product_name === preferName)) || candidates[0] || null
  }, { timeoutMs: 180_000, intervalMs: 5_000, label: `активное предложение ${supplierAccount} на КУ ${braname}` })
}

/**
 * Оформление заказа: корзина → превью → оформление. Заявление 1110 из
 * превью (если членского кошелька не хватает) подписывается ключом пайщика.
 */
export async function placeOrder(args: { who: Who, offerId: string, quantity: number, braname?: string }): Promise<{ orderId: string, orderHash: string }> {
  const { who, offerId, quantity, braname = KRG } = args
  const token = await tokenOf(who)
  await gql(token, 'mutation{ marketplaceClearCart{ __typename } }').catch(() => {})
  await gql(token, 'mutation($i:MarketplaceAddToCartInput!){ marketplaceAddToCart(input:$i){ __typename } }', {
    i: { offer_id: offerId, quantity, delivery_braname: braname },
  })
  const sp = await gql<any>(token, `query{
    marketplaceCheckoutSignablePayloads{
      lines{ offer_id package_id order_hash amount membership_fee from_member from_program from_wallet }
      convert{ amount membership_fee document{ full_title html hash meta binary } }
    }
  }`)
  const preview = sp.marketplaceCheckoutSignablePayloads
  if (!preview.lines.length)
    throw new Error('по позиции корзины не пришло превью оформления')
  const lines = preview.lines.map((p: any) => ({ offer_id: p.offer_id, package_id: p.package_id, order_hash: p.order_hash }))
  const signed_convert = preview.convert ? await signDocument(who.wif, preview.convert.document, who.account, 1) : null
  const co = await gql<any>(token, `mutation($i:MarketplaceCheckoutCartInput){
    marketplaceCheckoutCart(input:$i){ fully_completed created_orders{ id status } failed_lines{ reason } }
  }`, { i: { lines, signed_convert } })
  const result = co.marketplaceCheckoutCart
  if (!result.fully_completed)
    throw new Error(`оформление не прошло целиком: ${JSON.stringify(result.failed_lines)}`)
  const orderId = result.created_orders[0].id as string
  const ord = await gql<any>(token, 'query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ id order_hash } }', { i: { order_id: orderId } })
  return { orderId, orderHash: ord.marketplaceGetOrder.order_hash as string }
}

export const ORDER_FIELDS = 'id status order_hash quantity total_cost total_cost_with_fee membership_fee accepted_cost price_per_unit orderer_account supplier_account delivery_braname'

export async function getOrder(token: string, orderId: string): Promise<any> {
  const d = await gql<any>(token, `query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ ${ORDER_FIELDS} } }`, { i: { order_id: orderId } })
  return d.marketplaceGetOrder
}

// ── Приёмка ────────────────────────────────────────────────────────────────

/**
 * Приёмка: поставщик акцептует заказ, оператор ПВЗ оформляет экспресс-приёмку
 * с явным фактом, затем двухподписный АПП — поставщик и председатель КУ.
 */
export async function acceptToCoop(args: {
  supplier: Who
  operator: Who
  orderId: string
  braname?: string
  factQuantity: number
  factUnitPrice: number
}): Promise<{ aplId: string, txHash: string }> {
  const { supplier, operator, orderId, braname = KRG, factQuantity, factUnitPrice } = args
  const supplierToken = await tokenOf(supplier)
  const operatorToken = await tokenOf(operator)
  await gql(supplierToken, 'mutation($i:MarketplaceAcceptOrdersBatchInput!){ marketplaceAcceptOrdersBatch(input:$i){ __typename } }', { i: { order_ids: [orderId] } })
  const ex = await gql<any>(operatorToken, `mutation($d:MarketplaceCreateExpressReceptionInput!){
    marketplaceCreateExpressReception(data:$d){ apl_receptions{ id status fact_quantity_per_order{ order_id fact_quantity fact_unit_price } } }
  }`, {
    d: {
      braname,
      offerer_account: supplier.account,
      fact_quantity_per_order: [{ order_id: orderId, fact_quantity: factQuantity, fact_unit_price: factUnitPrice.toFixed(4) }],
    },
  })
  const apl = (ex.marketplaceCreateExpressReception.apl_receptions as any[]).find(r => r.fact_quantity_per_order.some((f: any) => f.order_id === orderId))
  if (!apl)
    throw new Error('экспресс-приёмка не включила заказ')
  const sp = await gql<any>(supplierToken, `query($d:MarketplaceAplReceptionByIdInput!){
    marketplaceAplReceptionSupplierSignablePayloads(data:$d){ full_title html hash meta binary }
  }`, { d: { apl_reception_id: apl.id } })
  const supplierSigned: any[] = []
  for (const p of sp.marketplaceAplReceptionSupplierSignablePayloads) supplierSigned.push(await signDocument(supplier.wif, p, supplier.account, 1))
  await gql(supplierToken, `mutation($d:MarketplaceSignAplReceptionInput!){
    marketplaceSignAplReceptionAsSupplier(data:$d){ apl_reception{ id status } }
  }`, { d: { apl_reception_id: apl.id, signed_documents: supplierSigned } })
  const cp = await gql<any>(operatorToken, `query($d:MarketplaceAplReceptionByIdInput!){
    marketplaceAplReceptionChairmanSignablePayloads(data:$d){
      hash
      rawDocument{ full_title html hash meta binary }
      document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }
    }
  }`, { d: { apl_reception_id: apl.id } })
  const chairSigned: any[] = []
  for (const p of cp.marketplaceAplReceptionChairmanSignablePayloads) chairSigned.push(await signDocument(operator.wif, p.rawDocument, operator.account, 2, [p.document]))
  const cs = await gql<any>(operatorToken, `mutation($d:MarketplaceSignAplReceptionInput!){
    marketplaceSignAplReceptionAsChairman(data:$d){ apl_reception{ id status chairman_signchair_tx_hash } }
  }`, { d: { apl_reception_id: apl.id, signed_documents: chairSigned } })
  return { aplId: apl.id, txHash: cs.marketplaceSignAplReceptionAsChairman.apl_reception.chairman_signchair_tx_hash }
}

/** Маркировка позиций склада — штатный шаг перед выдачей. */
export async function labelInventory(operatorToken: string, orderId: string): Promise<void> {
  const inv = await gql<any>(operatorToken, `query($d:MarketplaceListInventoryInput){
    marketplaceListInventory(data:$d){ id order_id barcode_value }
  }`, { d: { order_id: orderId } }).catch(() => null)
  for (const item of ((inv?.marketplaceListInventory ?? []) as any[]).filter(i => !i.barcode_value)) {
    await gql(operatorToken, `mutation($d:MarketplaceGenerateInventoryLabelInput!){
      marketplaceGenerateInventoryLabel(data:$d){ __typename }
    }`, { d: { inventory_id: item.id, format: 'EAN13' } }).catch(() => {})
  }
}

// ── Выдача ─────────────────────────────────────────────────────────────────

export const SAGA_FIELDS = 'id order_id order_hash stage decision_mode decision_id awaits_member_signature awaits_operator_close awaits_council last_error'

export async function sagaOf(token: string, orderId: string): Promise<any> {
  const d = await gql<any>(token, `query($d:MarketplaceIssuanceOrderInput!){ marketplaceIssuanceSaga(data:$d){ ${SAGA_FIELDS} } }`, { d: { order_id: orderId } })
  return d.marketplaceIssuanceSaga
}

/**
 * Выдача: бандл с фактом → заявления пайщика → решение совета (на стенде —
 * робот, делегированный по mktissue) → акт пайщика → закрывающая подпись
 * оператора.
 */
export async function issueOrder(args: {
  operator: Who
  member: Who
  orderId: string
  braname?: string
  actualQuantity: number
  actualUnitPrice: number
}): Promise<{ proposalId: string, orderIds: string[] }> {
  const { operator, member, orderId, braname = KRG, actualQuantity, actualUnitPrice } = args
  const operatorToken = await tokenOf(operator)
  const memberToken = await tokenOf(member)
  await ensureIdentityVerified(member.account)
  await labelInventory(operatorToken, orderId)
  const prop = await gql<any>(operatorToken, `mutation($d:MarketplaceCreateStockProposalInput!){
    marketplaceCreateStockProposal(data:$d){ id status member_account braname total_cost }
  }`, { d: { braname, member_account: member.account, order_items: [{ order_id: orderId, actual_quantity: actualQuantity, actual_unit_price: actualUnitPrice.toFixed(4) }] } })
  const proposalId = prop.marketplaceCreateStockProposal.id as string
  const pay = await gql<any>(memberToken, `query($d:MarketplaceResolveStockProposalInput!){
    marketplaceStockProposalSignablePayloads(data:$d){
      order_lines{ offer_id order_id order_hash statement{ full_title html hash meta binary } }
      convert{ amount membership_fee document{ full_title html hash meta binary } }
    }
  }`, { d: { proposal_id: proposalId } })
  const payload = pay.marketplaceStockProposalSignablePayloads
  const orderLines: any[] = []
  for (const l of payload.order_lines as any[]) orderLines.push({ order_hash: l.order_hash, signed_statement: await signDocument(member.wif, l.statement, member.account, 1) })
  const signedConvert = payload.convert ? await signDocument(member.wif, payload.convert.document, member.account, 1) : null
  const fin = await gql<any>(memberToken, `mutation($d:MarketplaceFinalizeStockIssuanceInput!){
    marketplaceFinalizeStockIssuance(data:$d){ proposal{ id status } order_ids sagas{ ${SAGA_FIELDS} } }
  }`, { d: { proposal_id: proposalId, order_lines: orderLines, signed_convert: signedConvert } })
  const orderIds = fin.marketplaceFinalizeStockIssuance.order_ids as string[]
  // Решение совета принимает робот (стенд делегирует ему mktissue).
  await waitFor(async () => ((await sagaOf(memberToken, orderId))?.awaits_member_signature ? true : null),
    { timeoutMs: 180_000, intervalMs: 1_500, label: `сага выдачи ${orderId}: решение совета` })
  const actPl = await gql<any>(memberToken, `query($d:MarketplaceIssuanceOrderInput!){
    marketplaceIssuanceActPayload(data:$d){ full_title html hash meta binary }
  }`, { d: { order_id: orderId } })
  await gql(memberToken, `mutation($d:MarketplaceSignIssuanceActInput!){ marketplaceSignIssuanceAct(data:$d){ ${SAGA_FIELDS} } }`,
    { d: { order_id: orderId, signed_act: await signDocument(member.wif, actPl.marketplaceIssuanceActPayload, member.account, 1) } })
  const closePl = await gql<any>(operatorToken, `query($d:MarketplaceIssuanceOrderInput!){
    marketplaceIssuanceClosePayload(data:$d){
      act_aggregate{
        hash
        rawDocument{ full_title html hash meta binary }
        document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }
      }
    }
  }`, { d: { order_id: orderId } })
  const agg = closePl.marketplaceIssuanceClosePayload.act_aggregate
  await gql(operatorToken, `mutation($d:MarketplaceSignIssuanceActInput!){ marketplaceCloseIssuance(data:$d){ ${SAGA_FIELDS} } }`,
    { d: { order_id: orderId, signed_act: await signDocument(operator.wif, agg.rawDocument, operator.account, 2, [agg.document]) } })
  return { proposalId, orderIds }
}

// ── Проводки по нитке процесса ─────────────────────────────────────────────

export interface LedgerRow {
  action: string
  globalSequence: string
  parentApplyGlobalSequence: string | null
  operationCode: string | null
  processHash: string | null
  username: string | null
  accountId: number | null
  walletFrom: string | null
  walletTo: string | null
  quantity: string | null
  memo: string | null
}

/**
 * Все строки ledger2 одной нитки. Код операции есть только у apply;
 * walletop/debit/credit получают его от родительского apply.
 */
export async function historyOfProcess(token: string, processHash: string): Promise<LedgerRow[]> {
  // Пустой хэш getLedger2History молча игнорирует и отдаёт весь журнал.
  if (!/^[0-9a-f]{64}$/i.test(processHash ?? ''))
    throw new Error(`historyOfProcess: ожидался hex-64 хэш нитки, получено «${processHash}»`)
  const d = await gql<any>(token, `query($i:GetLedger2HistoryInput!){
    getLedger2History(input:$i){ items { globalSequence parentApplyGlobalSequence action operationCode processHash username accountId walletFrom walletTo quantity memo } }
  }`, { i: { coopname: COOP, processHash: processHash.toLowerCase(), limit: 200, page: 1 } })
  const rows = d.getLedger2History.items as LedgerRow[]
  const codeOf = new Map(rows.filter(r => r.action === 'apply').map(r => [String(r.globalSequence), r.operationCode]))
  for (const r of rows) {
    if (!r.operationCode && r.parentApplyGlobalSequence)
      r.operationCode = codeOf.get(String(r.parentApplyGlobalSequence)) ?? null
  }
  return rows
}

export async function applyOpsOfProcess(token: string, processHash: string): Promise<LedgerRow[]> {
  return (await historyOfProcess(token, processHash)).filter(r => r.action === 'apply')
}
