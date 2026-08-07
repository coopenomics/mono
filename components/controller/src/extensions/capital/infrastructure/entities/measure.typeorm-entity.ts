import { Entity, Column, Index } from 'typeorm';
import { MeasureCatalogTag } from '../../domain/enums/measure-catalog-tag.enum';
import { MetricSeriesMode } from '../../domain/enums/metric-series-mode.enum';
import { MetricSeriesPeriod } from '../../domain/enums/metric-series-period.enum';
import { MetricStatus } from '../../domain/enums/metric-status.enum';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const MeasureEntityName = 'capital_measures';

@Entity(MeasureEntityName)
@Index(`idx_${MeasureEntityName}_measure_hash`, ['measure_hash'], { unique: true })
@Index(`idx_${MeasureEntityName}_coopname`, ['coopname'])
@Index(`idx_${MeasureEntityName}_status`, ['status'])
@Index(`idx_${MeasureEntityName}_tag`, ['tag'])
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

  /** Шаг локальной волны (лейбл в админке — «Волна») */
  @Column({
    type: 'enum',
    enum: MetricSeriesPeriod,
    default: MetricSeriesPeriod.DAY,
  })
  wave_period!: MetricSeriesPeriod;

  /** Категория справочника: личное / продукт / контент / кооп / качество */
  @Column({
    type: 'enum',
    enum: MeasureCatalogTag,
    default: MeasureCatalogTag.PRODUCT,
  })
  tag!: MeasureCatalogTag;

  @Column({ type: 'varchar', length: 255 })
  created_by!: string;

  @Column({
    type: 'enum',
    enum: MetricStatus,
    default: MetricStatus.ACTIVE,
  })
  declare status: MetricStatus;
}
