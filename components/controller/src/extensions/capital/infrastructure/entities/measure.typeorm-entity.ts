import { Entity, Column, Index } from 'typeorm';
import { MetricSeriesMode } from '../../domain/enums/metric-series-mode.enum';
import { MetricStatus } from '../../domain/enums/metric-status.enum';
import { BaseTypeormEntity } from '@coopenomics/extension-kit/sync';

export const MeasureEntityName = 'capital_measures';

@Entity(MeasureEntityName)
@Index(`idx_${MeasureEntityName}_measure_hash`, ['measure_hash'], { unique: true })
@Index(`idx_${MeasureEntityName}_coopname`, ['coopname'])
@Index(`idx_${MeasureEntityName}_status`, ['status'])
@Index(`idx_${MeasureEntityName}_coop_title_unit`, ['coopname', 'title', 'unit'])
@Index(`idx_${MeasureEntityName}_created_at`, ['_created_at'])
export class MeasureTypeormEntity extends BaseTypeormEntity {
  @Column({ type: 'varchar', length: 64 })
  measure_hash!: string;

  @Column({ type: 'varchar', length: 255 })
  coopname!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 64 })
  unit!: string;

  @Column({
    type: 'enum',
    enum: MetricSeriesMode,
    default: MetricSeriesMode.RATE,
  })
  series_mode!: MetricSeriesMode;

  @Column({ type: 'varchar', length: 255 })
  created_by!: string;

  @Column({
    type: 'enum',
    enum: MetricStatus,
    default: MetricStatus.ACTIVE,
  })
  declare status: MetricStatus;
}
