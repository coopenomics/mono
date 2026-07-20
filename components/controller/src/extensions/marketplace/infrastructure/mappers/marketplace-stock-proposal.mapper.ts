import { Injectable } from '@nestjs/common';
import { MarketplaceStockProposalDomainEntity } from '../../domain/entities/marketplace-stock-proposal.entity';
import { MarketplaceStockProposalEntity } from '../entities/marketplace-stock-proposal.entity';

@Injectable()
export class MarketplaceStockProposalMapper {
  toDomain(row: MarketplaceStockProposalEntity): MarketplaceStockProposalDomainEntity {
    return new MarketplaceStockProposalDomainEntity({
      id: row.id,
      coopname: row.coopname,
      braname: row.braname,
      member_account: row.member_account,
      operator_account: row.operator_account,
      items: row.items ?? [],
      status: row.status,
      created_order_ids: row.created_order_ids ?? [],
      resolved_at: row.resolved_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
