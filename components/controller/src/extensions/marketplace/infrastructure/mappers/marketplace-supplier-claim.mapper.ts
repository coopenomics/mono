import { Injectable } from '@nestjs/common';
import { MarketplaceSupplierClaimDomainEntity } from '../../domain/entities/marketplace-supplier-claim.entity';
import { MarketplaceSupplierClaimEntity } from '../entities/marketplace-supplier-claim.entity';

@Injectable()
export class MarketplaceSupplierClaimMapper {
  toDomain(row: MarketplaceSupplierClaimEntity): MarketplaceSupplierClaimDomainEntity {
    return new MarketplaceSupplierClaimDomainEntity({
      id: row.id,
      coopname: row.coopname,
      claim_hash: row.claim_hash,
      return_claim_id: row.return_claim_id,
      order_id: row.order_id,
      order_hash: row.order_hash,
      supplier_account: row.supplier_account,
      orderer_account: row.orderer_account,
      delivery_braname: row.delivery_braname,
      actual_quantity: Number(row.actual_quantity),
      amount: row.amount,
      reason_text: row.reason_text,
      inspection_result: row.inspection_result ?? '',
      photos: row.photos ?? [],
      reclamation: row.reclamation ?? null,
      status: row.status,
      issued_at: row.issued_at,
      decided_at: row.decided_at ?? null,
      refuse_reason: row.refuse_reason ?? null,
      auto_admitted: row.auto_admitted ?? false,
      issue_tx_hash: row.issue_tx_hash ?? '',
      decide_tx_hash: row.decide_tx_hash ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
