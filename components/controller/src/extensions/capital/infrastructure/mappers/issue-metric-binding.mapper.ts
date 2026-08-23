import { IssueMetricBindingDomainEntity } from '../../domain/entities/issue-metric-binding.entity';
import type { IIssueMetricBindingDatabaseData } from '../../domain/interfaces/issue-metric-binding-database.interface';
import { IssueMetricBindingTypeormEntity } from '../entities/issue-metric-binding.typeorm-entity';

export class IssueMetricBindingMapper {
  static toDomain(entity: IssueMetricBindingTypeormEntity): IssueMetricBindingDomainEntity {
    const databaseData: IIssueMetricBindingDatabaseData = {
      _id: entity._id,
      issue_hash: entity.issue_hash,
      metric_hash: entity.metric_hash,
      delta: entity.delta,
      block_num: entity.block_num,
      present: entity.present,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };
    return new IssueMetricBindingDomainEntity(databaseData);
  }

  static toEntity(domain: IssueMetricBindingDomainEntity): Partial<IssueMetricBindingTypeormEntity> {
    return {
      _id: domain._id,
      issue_hash: domain.issue_hash,
      metric_hash: domain.metric_hash,
      delta: domain.delta,
      block_num: domain.block_num,
      present: domain.present,
      status: domain.status ?? 'active',
      _created_at: domain._created_at,
      _updated_at: domain._updated_at,
    };
  }
}
