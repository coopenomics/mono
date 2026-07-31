import { ComponentMetricDomainEntity } from '../../domain/entities/component-metric.entity';
import { MetricStatus } from '../../domain/enums/metric-status.enum';
import type { IComponentMetricDatabaseData } from '../../domain/interfaces/component-metric-database.interface';
import { ComponentMetricTypeormEntity } from '../entities/component-metric.typeorm-entity';

export class ComponentMetricMapper {
  static toDomain(entity: ComponentMetricTypeormEntity): ComponentMetricDomainEntity {
    const databaseData: IComponentMetricDatabaseData = {
      _id: entity._id,
      metric_hash: entity.metric_hash,
      measure_hash: entity.measure_hash,
      coopname: entity.coopname,
      project_hash: entity.project_hash,
      target_value: entity.target_value,
      deadline: entity.deadline ?? null,
      created_by: entity.created_by,
      status: (entity.status as MetricStatus) ?? MetricStatus.ACTIVE,
      block_num: entity.block_num,
      present: entity.present,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };
    return new ComponentMetricDomainEntity(databaseData);
  }

  static toEntity(domain: ComponentMetricDomainEntity): Partial<ComponentMetricTypeormEntity> {
    return {
      _id: domain._id,
      metric_hash: domain.metric_hash,
      measure_hash: domain.measure_hash,
      coopname: domain.coopname,
      project_hash: domain.project_hash,
      target_value: domain.target_value,
      deadline: domain.deadline ?? null,
      created_by: domain.created_by,
      status: domain.status,
      block_num: domain.block_num,
      present: domain.present,
      _created_at: domain._created_at,
      _updated_at: domain._updated_at,
    };
  }
}
