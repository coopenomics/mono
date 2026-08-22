import { Entity, Column, Index } from 'typeorm';
import { MetricStatus } from '../../domain/enums/metric-status.enum';
import { BaseTypeormEntity } from '@coopenomics/extension-kit/sync';

export const ComponentMetricEntityName = 'capital_component_metrics';

@Entity(ComponentMetricEntityName)
@Index(`idx_${ComponentMetricEntityName}_metric_hash`, ['metric_hash'], { unique: true })
@Index(`idx_${ComponentMetricEntityName}_measure_hash`, ['measure_hash'])
@Index(`idx_${ComponentMetricEntityName}_project_hash`, ['project_hash'])
@Index(`idx_${ComponentMetricEntityName}_coopname`, ['coopname'])
@Index(`idx_${ComponentMetricEntityName}_status`, ['status'])
@Index(`idx_${ComponentMetricEntityName}_created_at`, ['_created_at'])
export class ComponentMetricTypeormEntity extends BaseTypeormEntity {
  @Column({ type: 'varchar', length: 64 })
  metric_hash!: string;

  @Column({ type: 'varchar', length: 64 })
  measure_hash!: string;

  @Column({ type: 'varchar', length: 255 })
  coopname!: string;

  @Column({ type: 'varchar', length: 64 })
  project_hash!: string;

  @Column({ type: 'double precision', default: 0 })
  target_value!: number;

  @Column({ type: 'timestamp', nullable: true })
  deadline?: Date | null;

  @Column({ type: 'varchar', length: 255 })
  created_by!: string;

  @Column({
    type: 'enum',
    enum: MetricStatus,
    default: MetricStatus.ACTIVE,
  })
  declare status: MetricStatus;
}
