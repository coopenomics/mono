import { Injectable } from '@nestjs/common';
import { MarketplaceWriteoffProposalDomainEntity } from '../../domain/entities/marketplace-writeoff-proposal.entity';
import { MarketplaceWriteoffProposalEntity } from '../entities/marketplace-writeoff-proposal.entity';

@Injectable()
export class MarketplaceWriteoffProposalMapper {
  toDomain(row: MarketplaceWriteoffProposalEntity): MarketplaceWriteoffProposalDomainEntity {
    return new MarketplaceWriteoffProposalDomainEntity({
      id: row.id,
      coopname: row.coopname,
      trigger: row.trigger,
      status: row.status,
      cycle_started_at: row.cycle_started_at,
      proposal_hash: row.proposal_hash ?? '',
      decision_id: row.decision_id !== null ? Number(row.decision_id) : null,
      proposed_by_account: row.proposed_by_account,
      decided_by_account: row.decided_by_account,
      items: row.items ?? [],
      total_amount: row.total_amount,
      protocol_doc: row.protocol_doc ?? null,
      statement_doc: row.statement_doc ?? null,
      reject_reason: row.reject_reason,
      decision_log: row.decision_log ?? [],
      submitted_at: row.submitted_at,
      authorized_at: row.authorized_at,
      executed_at: row.executed_at,
      rejected_at: row.rejected_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
