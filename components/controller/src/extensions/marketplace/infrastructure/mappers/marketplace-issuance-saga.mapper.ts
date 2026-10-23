import { Injectable } from '@nestjs/common';
import { MarketplaceIssuanceSagaDomainEntity } from '../../domain/entities/marketplace-issuance-saga.entity';
import { MarketplaceIssuanceSagaEntity } from '../entities/marketplace-issuance-saga.entity';

@Injectable()
export class MarketplaceIssuanceSagaMapper {
  toDomain(row: MarketplaceIssuanceSagaEntity): MarketplaceIssuanceSagaDomainEntity {
    return new MarketplaceIssuanceSagaDomainEntity({
      id: row.id,
      coopname: row.coopname,
      order_id: row.order_id,
      order_hash: row.order_hash,
      proposal_id: row.proposal_id,
      member_account: row.member_account,
      operator_account: row.operator_account,
      braname: row.braname,
      stage: row.stage,
      decision_mode: row.decision_mode ?? 'UNKNOWN',
      fact: row.fact,
      statement_document: row.statement_document,
      protocol_document: row.protocol_document,
      act1_document: row.act1_document,
      act2_document: row.act2_document,
      act_document_hash: row.act_document_hash,
      decision_id: row.decision_id,
      tx_hashes: row.tx_hashes ?? {},
      last_error: row.last_error,
      attempts: row.attempts ?? 0,
      decided_at: row.decided_at,
      closed_at: row.closed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
