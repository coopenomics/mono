import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MarketplaceModerationLogDomainRepository } from '../../domain/repositories/marketplace-moderation-log.repository';
import type {
  MarketplaceModerationLogDomainEntity,
  MarketplaceModerationAction,
} from '../../domain/entities/marketplace-moderation-log.entity';
import { MarketplaceModerationLogEntity } from '../entities/marketplace-moderation-log.entity';
import { MarketplaceModerationLogMapper } from '../mappers/marketplace-moderation-log.mapper';

@Injectable()
export class MarketplaceModerationLogRepositoryAdapter
  implements MarketplaceModerationLogDomainRepository
{
  constructor(
    @InjectRepository(MarketplaceModerationLogEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceModerationLogEntity>,
    private readonly mapper: MarketplaceModerationLogMapper
  ) {}

  async append(input: {
    offer_id: string;
    action: MarketplaceModerationAction;
    by_account: string;
    reason: string | null;
  }): Promise<MarketplaceModerationLogDomainEntity> {
    const row = this.repo.create({
      offer_id: input.offer_id,
      action: input.action,
      by_account: input.by_account,
      reason: input.reason,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async listByOffer(offer_id: string): Promise<MarketplaceModerationLogDomainEntity[]> {
    const rows = await this.repo.find({
      where: { offer_id },
      order: { created_at: 'ASC' },
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }
}
