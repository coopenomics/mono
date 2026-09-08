import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { rawDocumentAggregateSelector } from '../documents/documentAggregateSelector'
import { rawDecisionEntrySelector, rawPhotoSelector } from './returnClaimSelector'

/** Гарантийная претензия поставщику — раздел «Гарантийные возвраты» стола поставщика (99D-13). */
const rawSupplierClaimSelector = {
  id: true,
  coopname: true,
  claim_hash: true,
  return_claim_id: true,
  order_id: true,
  order_hash: true,
  supplier_account: true,
  orderer_account: true,
  orderer_name: true,
  delivery_braname: true,
  delivery_branch_name: true,
  product_name: true,
  unit_of_measure: true,
  package_size: true,
  actual_quantity: true,
  amount: true,
  reason_text: true,
  inspection_result: true,
  photos: rawPhotoSelector,
  reclamation: rawDocumentAggregateSelector,
  status: true,
  issued_at: true,
  decided_at: true,
  refuse_reason: true,
  auto_admitted: true,
  auto_admit_at: true,
  history: rawDecisionEntrySelector,
  created_at: true,
  updated_at: true,
}

const _validateSupplierClaim: MakeAllFieldsRequired<ValueTypes['MarketplaceSupplierClaim']> = rawSupplierClaimSelector

export const marketplaceSupplierClaimSelector = Selector('MarketplaceSupplierClaim')(rawSupplierClaimSelector)

const rawSupplierClaimSummarySelector = {
  admitted_debt: true,
  refused_total: true,
  pending_total: true,
  symbol: true,
}

const _validateSummary: MakeAllFieldsRequired<ValueTypes['MarketplaceSupplierClaimSummary']> = rawSupplierClaimSummarySelector

export const marketplaceSupplierClaimSummarySelector = Selector('MarketplaceSupplierClaimSummary')(rawSupplierClaimSummarySelector)

const rawSupplierClaimResultSelector = {
  claim: rawSupplierClaimSelector,
  tx_hash: true,
}

const _validateResult: MakeAllFieldsRequired<ValueTypes['MarketplaceSupplierClaimResult']> = rawSupplierClaimResultSelector

export const marketplaceSupplierClaimResultSelector = Selector('MarketplaceSupplierClaimResult')(rawSupplierClaimResultSelector)
