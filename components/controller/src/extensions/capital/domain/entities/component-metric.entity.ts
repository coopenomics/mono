import { MetricSeriesMode } from '../enums/metric-series-mode.enum';
import { MetricStatus } from '../enums/metric-status.enum';
import type { IComponentMetricDatabaseData } from '../interfaces/component-metric-database.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

export class ComponentMetricDomainEntity extends BaseDomainEntity<IComponentMetricDatabaseData> {
  public metric_hash: string;
  public coopname: string;
  public project_hash: string;
  public title: string;
  public unit: string;
  public target_value: number;
  public deadline?: Date | null;
  public series_mode: MetricSeriesMode;
  public created_by: string;
  declare public status: MetricStatus;

  constructor(databaseData: IComponentMetricDatabaseData) {
    super(databaseData, MetricStatus.ACTIVE);

    this.metric_hash = databaseData.metric_hash.toLowerCase();
    this.coopname = databaseData.coopname;
    this.project_hash = databaseData.project_hash.toLowerCase();
    this.title = databaseData.title;
    this.unit = databaseData.unit;
    this.target_value = databaseData.target_value;
    this.deadline = databaseData.deadline ?? null;
    this.series_mode = databaseData.series_mode ?? MetricSeriesMode.RATE;
    this.created_by = databaseData.created_by;
    this.status = databaseData.status ?? MetricStatus.ACTIVE;
  }

  archive(): void {
    this.status = MetricStatus.ARCHIVED;
  }
}
