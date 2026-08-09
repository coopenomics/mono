import { MeasureCatalogTag } from '../enums/measure-catalog-tag.enum';
import { MetricSeriesMode } from '../enums/metric-series-mode.enum';
import { MetricSeriesPeriod } from '../enums/metric-series-period.enum';
import { MetricStatus } from '../enums/metric-status.enum';
import type { IMeasureDatabaseData } from '../interfaces/measure-database.interface';
import { BaseDomainEntity } from '@coopenomics/extension-kit/sync';

export class MeasureDomainEntity extends BaseDomainEntity<IMeasureDatabaseData> {
  public measure_hash: string;
  public coopname: string;
  public title: string;
  public unit: string;
  public series_mode: MetricSeriesMode;
  public wave_period: MetricSeriesPeriod;
  public tag: MeasureCatalogTag;
  public created_by: string;
  declare public status: MetricStatus;

  constructor(databaseData: IMeasureDatabaseData) {
    super(databaseData, MetricStatus.ACTIVE);

    this.measure_hash = databaseData.measure_hash.toLowerCase();
    this.coopname = databaseData.coopname;
    this.title = databaseData.title.trim();
    this.unit = databaseData.unit.trim();
    this.series_mode = databaseData.series_mode ?? MetricSeriesMode.RATE;
    this.wave_period = databaseData.wave_period ?? MetricSeriesPeriod.DAY;
    this.tag = databaseData.tag ?? MeasureCatalogTag.PRODUCT;
    this.created_by = databaseData.created_by;
    this.status = databaseData.status ?? MetricStatus.ACTIVE;
  }

  archive(): void {
    this.status = MetricStatus.ARCHIVED;
  }
}
