import { Injectable } from '@nestjs/common';
import { MarketplaceConsolidatedRequestDomainEntity } from '../../domain/entities/marketplace-consolidated-request.entity';
import { MarketplaceConsolidatedRequestEntity } from '../entities/marketplace-consolidated-request.entity';

@Injectable()
export class MarketplaceConsolidatedRequestMapper {
  toDomain(row: MarketplaceConsolidatedRequestEntity): MarketplaceConsolidatedRequestDomainEntity {
    return new MarketplaceConsolidatedRequestDomainEntity({
      id: row.id,
      coopname: row.coopname,
      offer_id: row.offer_id,
      supplier_account: row.supplier_account,
      total_quantity: row.total_quantity,
      total_amount: row.total_amount,
      status: row.status,
      cycle_started_at: row.cycle_started_at,
      cycle_ended_at: row.cycle_ended_at,
      expires_at: row.expires_at,
      accepted_at: row.accepted_at,
      declined_at: row.declined_at,
      decline_reason: row.decline_reason,
      triggered_by_supplier_at: row.triggered_by_supplier_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
