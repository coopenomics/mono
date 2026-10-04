import { TableStore } from '@coopenomics/extension-kit';
import { MARKETPLACE_MODERATION_LOG_STORE } from '../../infrastructure/database/marketplace-stores';
import { Inject, Injectable } from '@nestjs/common';
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
    @Inject(MARKETPLACE_MODERATION_LOG_STORE)
private readonly repo: TableStore<MarketplaceModerationLogEntity>,
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
    const rows = await this.repo.find({ offer_id }, { order: { created_at: 'ASC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }
}
