import { Entity, Column, Index } from 'typeorm';
import { MetricContributionSource } from '../../domain/enums/metric-contribution-source.enum';
import { BaseTypeormEntity } from '@coopenomics/extension-kit/sync';

export const MetricContributionEntityName = 'capital_metric_contributions';

@Entity(MetricContributionEntityName)
@Index(`idx_${MetricContributionEntityName}_contribution_hash`, ['contribution_hash'], { unique: true })
@Index(`idx_${MetricContributionEntityName}_metric_hash`, ['metric_hash'])
@Index(`idx_${MetricContributionEntityName}_issue_hash`, ['issue_hash'])
@Index(`idx_${MetricContributionEntityName}_occurred_at`, ['occurred_at'])
export class MetricContributionTypeormEntity extends BaseTypeormEntity {
  @Column({ type: 'varchar', length: 64 })
  contribution_hash!: string;

  @Column({ type: 'varchar', length: 64 })
  metric_hash!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  issue_hash?: string | null;

  @Column({ type: 'double precision', default: 0 })
  delta!: number;

  @Column({
    type: 'enum',
    enum: MetricContributionSource,
  })
  source!: MetricContributionSource;

  @Column({ type: 'varchar', length: 255 })
  username!: string;

  @Column({ type: 'timestamp' })
  occurred_at!: Date;
}
