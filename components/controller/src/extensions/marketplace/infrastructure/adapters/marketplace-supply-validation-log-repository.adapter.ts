import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceSupplyValidationLogDomainEntity } from '../../domain/entities/marketplace-supply-validation-log.entity';
import type {
  MarketplaceSupplyValidationLogCreateInput,
  MarketplaceSupplyValidationLogDomainRepository,
} from '../../domain/repositories/marketplace-supply-validation-log.repository';
import { MarketplaceSupplyValidationLogEntity } from '../entities/marketplace-supply-validation-log.entity';
import { MarketplaceSupplyValidationLogMapper } from '../mappers/marketplace-supply-validation-log.mapper';

@Injectable()
export class MarketplaceSupplyValidationLogRepositoryAdapter
  implements MarketplaceSupplyValidationLogDomainRepository
{
  constructor(
    @InjectRepository(MarketplaceSupplyValidationLogEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceSupplyValidationLogEntity>,
    private readonly mapper: MarketplaceSupplyValidationLogMapper
  ) {}

  async create(
    input: MarketplaceSupplyValidationLogCreateInput
  ): Promise<MarketplaceSupplyValidationLogDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      cycle_id: input.cycle_id,
      offerer_account: input.offerer_account,
      outcome: input.outcome,
      reason: input.reason,
      reason_code: input.reason_code,
      attempted_groups: input.attempted_groups,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async findByCycleId(
    coopname: string,
    cycle_id: string
  ): Promise<MarketplaceSupplyValidationLogDomainEntity[]> {
    const rows = await this.repo.find({
      where: { coopname, cycle_id },
      order: { created_at: 'DESC' },
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }
}
