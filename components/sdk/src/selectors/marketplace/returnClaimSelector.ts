import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawPhotoSelector = {
  url: true,
  content_hash: true,
  mime_type: true,
  uploaded_at: true,
}

const _validatePhoto: MakeAllFieldsRequired<ValueTypes['MarketplaceReturnClaimPhoto']> =
  rawPhotoSelector

export const marketplaceReturnClaimPhotoSelector = Selector('MarketplaceReturnClaimPhoto')(
  rawPhotoSelector,
)

const rawDecisionEntrySelector = {
  stage: true,
  decision: true,
  by_chairman_account: true,
  braname: true,
  comment: true,
  at: true,
  tx_hash: true,
}

const _validateDecision: MakeAllFieldsRequired<
  ValueTypes['MarketplaceReturnClaimDecisionEntry']
> = rawDecisionEntrySelector

export const marketplaceReturnClaimDecisionEntrySelector = Selector(
  'MarketplaceReturnClaimDecisionEntry',
)(rawDecisionEntrySelector)

const rawOnSiteInspectionSelector = {
  result_text: true,
  photos: rawPhotoSelector,
  scanned_barcode: true,
  by_chairman_account: true,
  at: true,
}

const _validateInspection: MakeAllFieldsRequired<
  ValueTypes['MarketplaceReturnClaimOnSiteInspection']
> = rawOnSiteInspectionSelector

export const marketplaceReturnClaimOnSiteInspectionSelector = Selector(
  'MarketplaceReturnClaimOnSiteInspection',
)(rawOnSiteInspectionSelector)

const rawLedgerSnapshotSelector = {
  amount: true,
  returned_quantity: true,
  tx_hash: true,
  at: true,
}

const _validateLedger: MakeAllFieldsRequired<
  ValueTypes['MarketplaceReturnClaimLedgerSnapshot']
> = rawLedgerSnapshotSelector

export const marketplaceReturnClaimLedgerSnapshotSelector = Selector(
  'MarketplaceReturnClaimLedgerSnapshot',
)(rawLedgerSnapshotSelector)

const rawClaimSelector = {
  id: true,
  coopname: true,
  request_hash: true,
  order_id: true,
  order_hash: true,
  product_name: true,
  unit_of_measure: true,
  package_size: true,
  orderer_account: true,
  delivery_braname: true,
  supplier_account: true,
  status: true,
  reason_text: true,
  defect_category: true,
  expected_resolution: true,
  actual_quantity: true,
  fact_cost: true,
  fee_refund: true,
  total_refund: true,
  photos: rawPhotoSelector,
  submretrn_tx_hash: true,
  decision_log: rawDecisionEntrySelector,
  on_site_inspection: rawOnSiteInspectionSelector,
  ledger_snapshot: rawLedgerSnapshotSelector,
  created_at: true,
  updated_at: true,
}

const _validateClaim: MakeAllFieldsRequired<ValueTypes['MarketplaceReturnClaim']> =
  rawClaimSelector

export const marketplaceReturnClaimSelector = Selector('MarketplaceReturnClaim')(rawClaimSelector)

const rawClaimResultSelector = {
  claim: rawClaimSelector,
  tx_hash: true,
}

const _validateResult: MakeAllFieldsRequired<
  ValueTypes['MarketplaceReturnClaimResult']
> = rawClaimResultSelector

export const marketplaceReturnClaimResultSelector = Selector('MarketplaceReturnClaimResult')(
  rawClaimResultSelector,
)
