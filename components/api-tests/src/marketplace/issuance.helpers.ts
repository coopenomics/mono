/**
 * Шаги выдачи для тестов marketplace.issuance по отдельности. Общий
 * `issueOrder` (flow.ts) проводит выдачу целиком; случаям реестра нужно
 * остановиться на каждом этапе и вмешаться — чужой пайщик, подменённая
 * подпись, цена выше потолка. Здесь только действия и чтение, ассертов нет.
 */
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { gql } from '../core/client'
import { docMeta, signDocument } from '../core/documents'
import { amount } from '../core/wallet'
import { KRG, SAGA_FIELDS, acceptToCoop, ensureIdentityVerified, labelInventory, placeOrder } from './flow'

export interface PreparedOrder {
  orderId: string
  orderHash: string
}

/**
 * Заказ пайщика, принятый кооперативом: оформление, акцепт поставщиком,
 * экспресс-приёмка с явным фактом (сколько привезли и по какой цене прибытия),
 * маркировка. Личность получателя подтверждена — без этого факт выдачи
 * отвергается раньше проверок, ради которых написаны тесты.
 */
export async function prepareReceivedOrder(args: {
  member: Who
  supplier: Who
  operator: Who
  offerId: string
  quantity: number
  receivedQuantity: number
  arrivalPrice: number
}): Promise<PreparedOrder> {
  const { orderId, orderHash } = await placeOrder({ who: args.member, offerId: args.offerId, quantity: args.quantity })
  await acceptToCoop({
    supplier: args.supplier,
    operator: args.operator,
    orderId,
    factQuantity: args.receivedQuantity,
    factUnitPrice: args.arrivalPrice,
  })
  await labelInventory(await tokenOf(args.operator), orderId)
  await ensureIdentityVerified(args.member.account)
  return { orderId, orderHash }
}

export interface BundleLine {
  order_id: string
  actual_quantity: number
  actual_unit_price: string
}

export const CREATE_BUNDLE = `mutation($d:MarketplaceCreateStockProposalInput!){
  marketplaceCreateStockProposal(data:$d){ id status member_account braname total_cost }
}`

export function bundleInput(memberAccount: string, lines: BundleLine[]) {
  return { d: { braname: KRG, member_account: memberAccount, order_items: lines } }
}

/** Бандл выдачи у стойки: рождает саги в FACT_FIXED по каждому заказу. */
export async function createBundle(operatorToken: string, memberAccount: string, lines: BundleLine[]): Promise<string> {
  const d = await gql<any>(operatorToken, CREATE_BUNDLE, bundleInput(memberAccount, lines))
  return d.marketplaceCreateStockProposal.id as string
}

export interface BundlePayloads {
  /** Заявление 1113 по каждому заказу бандла, ключ — хэш заказа. */
  statements: Map<string, any>
  convert: any | null
}

export async function bundlePayloads(memberToken: string, proposalId: string): Promise<BundlePayloads> {
  const d = await gql<any>(memberToken, `query($d:MarketplaceResolveStockProposalInput!){
    marketplaceStockProposalSignablePayloads(data:$d){
      order_lines{ order_id order_hash statement{ full_title html hash meta binary } }
      convert{ amount membership_fee document{ full_title html hash meta binary } }
    }
  }`, { d: { proposal_id: proposalId } })
  const p = d.marketplaceStockProposalSignablePayloads
  return {
    statements: new Map((p.order_lines as any[]).map(l => [l.order_hash as string, l.statement])),
    convert: p.convert ?? null,
  }
}

export const FINALIZE = `mutation($d:MarketplaceFinalizeStockIssuanceInput!){
  marketplaceFinalizeStockIssuance(data:$d){ proposal{ id status } order_ids sagas{ ${SAGA_FIELDS} } }
}`

export function finalizeInput(proposalId: string, orderLines: { order_hash: string, signed_statement: unknown }[]) {
  return { d: { proposal_id: proposalId, order_lines: orderLines, signed_convert: null } }
}

export async function signStatement(member: Who, statement: unknown): Promise<any> {
  return signDocument(member.wif, statement, member.account, 1)
}

export async function actPayload(memberToken: string, orderId: string): Promise<any> {
  const d = await gql<any>(memberToken, `query($d:MarketplaceIssuanceOrderInput!){
    marketplaceIssuanceActPayload(data:$d){ full_title html hash meta binary }
  }`, { d: { order_id: orderId } })
  return d.marketplaceIssuanceActPayload
}

export const SIGN_ACT = `mutation($d:MarketplaceSignIssuanceActInput!){ marketplaceSignIssuanceAct(data:$d){ ${SAGA_FIELDS} } }`
export const CLOSE = `mutation($d:MarketplaceSignIssuanceActInput!){ marketplaceCloseIssuance(data:$d){ ${SAGA_FIELDS} } }`

/** Акт с подписью заказчика — агрегат для закрывающей подписи оператора. */
export async function closeAggregate(operatorToken: string, orderId: string): Promise<{ rawDocument: any, document: any }> {
  const d = await gql<any>(operatorToken, `query($d:MarketplaceIssuanceOrderInput!){
    marketplaceIssuanceClosePayload(data:$d){
      act_aggregate{
        hash
        rawDocument{ full_title html hash meta binary }
        document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }
      }
    }
  }`, { d: { order_id: orderId } })
  return d.marketplaceIssuanceClosePayload.act_aggregate
}

/** Подписанный документ из агрегата как вход мутации (мета — объектом). */
export function aggregateAsInput(document: any): any {
  return { ...document, meta: docMeta(document.meta) }
}

export interface OfferCounters {
  available: number
  blocked: number
  consumed: number
}

export async function offerCounters(token: string, offerId: string): Promise<OfferCounters> {
  const d = await gql<any>(token, 'query($id:String!){ marketplaceGetOffer(id:$id){ quantity_available quantity_blocked quantity_consumed } }', { id: offerId })
  const o = d.marketplaceGetOffer
  return { available: Number(o.quantity_available), blocked: Number(o.quantity_blocked), consumed: Number(o.quantity_consumed) }
}

export interface InventoryRow {
  id: string
  order_id: string
  status: string
  ownership: string
  origin: string
  quantity_per_label: number
  arrival_price: string | null
}

export async function inventoryOfOrder(token: string, orderId: string): Promise<InventoryRow[]> {
  const d = await gql<any>(token, `query($d:MarketplaceListInventoryInput){
    marketplaceListInventory(data:$d){ id order_id status ownership origin quantity_per_label arrival_price }
  }`, { d: { order_id: orderId } })
  return (d.marketplaceListInventory as any[]).map(r => ({ ...r, quantity_per_label: Number(r.quantity_per_label) }))
}

/** Сумма количества строк склада по условию. */
export function sumQty(rows: InventoryRow[], pick: (r: InventoryRow) => boolean): number {
  return Number(rows.filter(pick).reduce((s, r) => s + r.quantity_per_label, 0).toFixed(6))
}

/** Цена с двумя знаками — так сумма в рублях не зависит от округления до копейки. */
export function price2(n: number): number {
  return Math.round(n * 100) / 100
}

export function money(n: number): string {
  return n.toFixed(4)
}

export { amount }
