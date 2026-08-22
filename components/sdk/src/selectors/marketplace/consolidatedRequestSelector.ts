import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawConsolidatedRequestSelector = {
  id: true,
  coopname: true,
  offer_id: true,
  supplier_account: true,
  status: true,
  total_quantity: true,
  total_amount: true,
  cycle_started_at: true,
  cycle_ended_at: true,
  expires_at: true,
  accepted_at: true,
  declined_at: true,
  decline_reason: true,
  triggered_by_supplier_at: true,
  created_at: true,
  updated_at: true,
}

const _validateConsolidatedRequest: MakeAllFieldsRequired<
  ValueTypes['MarketplaceConsolidatedRequest']
> = rawConsolidatedRequestSelector

export const marketplaceConsolidatedRequestSelector = Selector('MarketplaceConsolidatedRequest')(
  rawConsolidatedRequestSelector,
)
