import { Injectable } from '@nestjs/common';
import { MarketplaceModerationLogDomainEntity } from '../../domain/entities/marketplace-moderation-log.entity';
import { MarketplaceModerationLogEntity } from '../entities/marketplace-moderation-log.entity';

@Injectable()
export class MarketplaceModerationLogMapper {
  toDomain(row: MarketplaceModerationLogEntity): MarketplaceModerationLogDomainEntity {
    return new MarketplaceModerationLogDomainEntity({
      id: row.id,
      offer_id: row.offer_id,
      action: row.action,
      by_account: row.by_account,
      reason: row.reason,
      created_at: row.created_at,
    });
  }
}
