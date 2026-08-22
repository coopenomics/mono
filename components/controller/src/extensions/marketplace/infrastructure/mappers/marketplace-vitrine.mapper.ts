import { Injectable } from '@nestjs/common';
import { MarketplaceVitrineDomainEntity } from '../../domain/entities/marketplace-vitrine.entity';
import { MarketplaceVitrineEntity } from '../entities/marketplace-vitrine.entity';

@Injectable()
export class MarketplaceVitrineMapper {
  toDomain(row: MarketplaceVitrineEntity): MarketplaceVitrineDomainEntity {
    return new MarketplaceVitrineDomainEntity({
      id: row.id,
      coopname: row.coopname,
      display_name: row.display_name,
      is_default: row.is_default,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
