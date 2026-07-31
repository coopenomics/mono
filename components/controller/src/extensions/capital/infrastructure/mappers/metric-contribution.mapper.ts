import { MetricContributionDomainEntity } from '../../domain/entities/metric-contribution.entity';
import type { IMetricContributionDatabaseData } from '../../domain/interfaces/metric-contribution-database.interface';
import { MetricContributionTypeormEntity } from '../entities/metric-contribution.typeorm-entity';

export class MetricContributionMapper {
  static toDomain(entity: MetricContributionTypeormEntity): MetricContributionDomainEntity {
    const databaseData: IMetricContributionDatabaseData = {
      _id: entity._id,
      contribution_hash: entity.contribution_hash,
      metric_hash: entity.metric_hash,
      issue_hash: entity.issue_hash,
      delta: entity.delta,
      source: entity.source,
      username: entity.username,
      occurred_at: entity.occurred_at,
      block_num: entity.block_num,
      present: entity.present,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };
    return new MetricContributionDomainEntity(databaseData);
  }

  static toEntity(domain: MetricContributionDomainEntity): Partial<MetricContributionTypeormEntity> {
    return {
      _id: domain._id,
      contribution_hash: domain.contribution_hash,
      metric_hash: domain.metric_hash,
      issue_hash: domain.issue_hash ?? null,
      delta: domain.delta,
      source: domain.source,
      username: domain.username,
      occurred_at: domain.occurred_at,
      block_num: domain.block_num,
      present: domain.present,
      status: domain.status ?? 'active',
      _created_at: domain._created_at,
      _updated_at: domain._updated_at,
    };
  }
}
