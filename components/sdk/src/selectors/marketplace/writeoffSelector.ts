import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawItemSelector = {
  braname: true,
  branch_name: true,
  asset_title: true,
  quantity: true,
  amount: true,
  reason: true,
  inventory_id: true,
  executed: true,
}

const _validateItem: MakeAllFieldsRequired<ValueTypes['MarketplaceWriteoffProposalItem']> =
  rawItemSelector

export const marketplaceWriteoffProposalItemSelector = Selector('MarketplaceWriteoffProposalItem')(
  rawItemSelector,
)

const rawDecisionEntrySelector = {
  at: true,
  actor: true,
  action: true,
}

const _validateEntry: MakeAllFieldsRequired<ValueTypes['MarketplaceWriteoffDecisionEntry']> =
  rawDecisionEntrySelector

export const marketplaceWriteoffDecisionEntrySelector = Selector('MarketplaceWriteoffDecisionEntry')(
  rawDecisionEntrySelector,
)

const rawProposalSelector = {
  id: true,
  coopname: true,
  trigger: true,
  status: true,
  cycle_started_at: true,
  proposal_hash: true,
  decision_id: true,
  proposed_by_account: true,
  decided_by_account: true,
  items: rawItemSelector,
  total_amount: true,
  reject_reason: true,
  decision_log: rawDecisionEntrySelector,
  submitted_at: true,
  authorized_at: true,
  executed_at: true,
  rejected_at: true,
  created_at: true,
  updated_at: true,
}

const _validateProposal: MakeAllFieldsRequired<ValueTypes['MarketplaceWriteoffProposal']> =
  rawProposalSelector

export const marketplaceWriteoffProposalSelector = Selector('MarketplaceWriteoffProposal')(
  rawProposalSelector,
)

const rawPaginatedSelector = {
  items: rawProposalSelector,
  totalCount: true,
  totalPages: true,
  currentPage: true,
}

const _validatePaginated: MakeAllFieldsRequired<
  ValueTypes['PaginatedMarketplaceWriteoffProposals']
> = rawPaginatedSelector

export const paginatedMarketplaceWriteoffProposalsSelector = Selector(
  'PaginatedMarketplaceWriteoffProposals',
)(rawPaginatedSelector)

const rawCandidateSelector = {
  inventory_id: true,
  braname: true,
  branch_name: true,
  asset_title: true,
  quantity: true,
  amount: true,
  reason: true,
  expiry_date: true,
  is_expired: true,
}

const _validateCandidate: MakeAllFieldsRequired<ValueTypes['MarketplaceWriteoffCandidate']> =
  rawCandidateSelector

export const marketplaceWriteoffCandidateSelector = Selector('MarketplaceWriteoffCandidate')(
  rawCandidateSelector,
)

const rawConfirmationGroupSelector = {
  proposal_id: true,
  proposal_hash: true,
  braname: true,
  branch_name: true,
  cycle_started_at: true,
  authorized_at: true,
  protocol_doc: true,
  items: rawItemSelector,
  total_amount: true,
}

const _validateConfirmationGroup: MakeAllFieldsRequired<
  ValueTypes['MarketplaceWriteoffConfirmationGroup']
> = rawConfirmationGroupSelector

export const marketplaceWriteoffConfirmationGroupSelector = Selector(
  'MarketplaceWriteoffConfirmationGroup',
)(rawConfirmationGroupSelector)
