import { Injectable } from '@nestjs/common';
import { MarketplaceReturnClaimDomainEntity } from '../../domain/entities/marketplace-return-claim.entity';
import { MarketplaceReturnClaimEntity } from '../entities/marketplace-return-claim.entity';

@Injectable()
export class MarketplaceReturnClaimMapper {
  toDomain(row: MarketplaceReturnClaimEntity): MarketplaceReturnClaimDomainEntity {
    return new MarketplaceReturnClaimDomainEntity({
      id: row.id,
      coopname: row.coopname,
      request_hash: row.request_hash,
      order_id: row.order_id,
      order_hash: row.order_hash,
      orderer_account: row.orderer_account,
      delivery_braname: row.delivery_braname,
      supplier_account: row.supplier_account,
      status: row.status,
      reason_text: row.reason_text,
      defect_category: row.defect_category,
      expected_resolution: row.expected_resolution,
      actual_quantity: row.actual_quantity,
      fact_cost: row.fact_cost,
      fee_refund: row.fee_refund,
      photos: row.photos,
      statement: row.statement,
      council_decision_id: row.council_decision_id ?? null,
      council_decision_mode: row.council_decision_mode ?? null,
      council_protocol: row.council_protocol ?? null,
      accepted_at: row.accepted_at ?? null,
      submretrn_tx_hash: row.submretrn_tx_hash,
      decision_log: row.decision_log,
      on_site_inspection: row.on_site_inspection,
      ledger_snapshot: row.ledger_snapshot,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
