import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const IssueMetricBindingEntityName = 'capital_issue_metric_bindings';

@Entity(IssueMetricBindingEntityName)
@Unique(`uq_${IssueMetricBindingEntityName}_issue_metric`, ['issue_hash', 'metric_hash'])
@Index(`idx_${IssueMetricBindingEntityName}_issue_hash`, ['issue_hash'])
@Index(`idx_${IssueMetricBindingEntityName}_metric_hash`, ['metric_hash'])
export class IssueMetricBindingTypeormEntity extends BaseTypeormEntity {
  @Column({ type: 'varchar', length: 64 })
  issue_hash!: string;

  @Column({ type: 'varchar', length: 64 })
  metric_hash!: string;

  @Column({ type: 'double precision', default: 0 })
  delta!: number;
}
