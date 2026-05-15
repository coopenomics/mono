import { Injectable } from '@nestjs/common';
import { MarketplaceWhitelistEntryDomainEntity } from '../../domain/entities/marketplace-whitelist-entry.entity';
import { MarketplaceWhitelistEntity } from '../entities/marketplace-whitelist.entity';

@Injectable()
export class MarketplaceWhitelistMapper {
  toDomain(row: MarketplaceWhitelistEntity): MarketplaceWhitelistEntryDomainEntity {
    return new MarketplaceWhitelistEntryDomainEntity({
      id: row.id,
      cooperative_id: row.cooperative_id,
      member_account: row.member_account,
      role: row.role,
      added_by: row.added_by,
      added_at: row.added_at,
    });
  }
}
