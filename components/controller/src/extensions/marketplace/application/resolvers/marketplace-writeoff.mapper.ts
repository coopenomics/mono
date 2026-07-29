import type { MarketplaceWriteoffProposalDomainEntity } from '../../domain/entities/marketplace-writeoff-proposal.entity';
import type { MarketplaceWriteoffProposalDecisionEntry } from '../../domain/entities/marketplace-writeoff-proposal.types';
import {
  MarketplaceWriteoffDecisionEntryDTO,
  MarketplaceWriteoffProposalDTO,
  MarketplaceWriteoffProposalItemDTO,
  MarketplaceWriteoffProposalStatusEnum,
  MarketplaceWriteoffProposalTriggerEnum,
} from '../dto/marketplace-writeoff.dto';

export function toMarketplaceWriteoffProposalDTO(
  entity: MarketplaceWriteoffProposalDomainEntity
): MarketplaceWriteoffProposalDTO {
  const dto = new MarketplaceWriteoffProposalDTO();
  dto.id = entity.id;
  dto.coopname = entity.coopname;
  dto.trigger = entity.trigger as unknown as MarketplaceWriteoffProposalTriggerEnum;
  dto.status = entity.status as unknown as MarketplaceWriteoffProposalStatusEnum;
  dto.cycle_started_at = entity.cycle_started_at.toISOString();
  dto.proposal_hash = entity.proposal_hash;
  dto.decision_id = entity.decision_id;
  dto.proposed_by_account = entity.proposed_by_account;
  dto.decided_by_account = entity.decided_by_account;
  dto.items = (entity.items ?? []).map((it) => {
    const d = new MarketplaceWriteoffProposalItemDTO();
    d.braname = it.braname;
    d.asset_title = it.asset_title;
    d.unit_of_measure = null;
    d.package_size = null;
    d.quantity = it.quantity;
    d.amount = it.amount;
    d.inventory_ids = it.inventory_ids ?? [];
    d.executed = it.executed;
    return d;
  });
  dto.total_amount = entity.total_amount;
  dto.reject_reason = entity.reject_reason;
  dto.decision_log = (entity.decision_log ?? []).map(toMarketplaceWriteoffDecisionEntryDTO);
  dto.submitted_at = entity.submitted_at?.toISOString() ?? null;
  dto.authorized_at = entity.authorized_at?.toISOString() ?? null;
  dto.executed_at = entity.executed_at?.toISOString() ?? null;
  dto.rejected_at = entity.rejected_at?.toISOString() ?? null;
  dto.created_at = entity.created_at.toISOString();
  dto.updated_at = entity.updated_at.toISOString();
  return dto;
}

function toMarketplaceWriteoffDecisionEntryDTO(
  entry: MarketplaceWriteoffProposalDecisionEntry
): MarketplaceWriteoffDecisionEntryDTO {
  const dto = new MarketplaceWriteoffDecisionEntryDTO();
  dto.at = entry.at;
  dto.actor = entry.actor;
  dto.action = entry.action;
  return dto;
}
