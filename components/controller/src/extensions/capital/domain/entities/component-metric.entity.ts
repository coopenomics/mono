import { MetricStatus } from '../enums/metric-status.enum';
import type { IComponentMetricDatabaseData } from '../interfaces/component-metric-database.interface';
import { BaseDomainEntity } from '@coopenomics/extension-kit/sync';

/**
 * Цель по мере на компоненте.
 * Название/единица/режим ряда — на мере (`measure_hash`).
 */
export class ComponentMetricDomainEntity extends BaseDomainEntity<IComponentMetricDatabaseData> {
  public metric_hash: string;
  public measure_hash: string;
  public coopname: string;
  public project_hash: string;
  public target_value: number;
  public deadline?: Date | null;
  public created_by: string;
  declare public status: MetricStatus;

  constructor(databaseData: IComponentMetricDatabaseData) {
    super(databaseData, MetricStatus.ACTIVE);

    this.metric_hash = databaseData.metric_hash.toLowerCase();
    this.measure_hash = databaseData.measure_hash.toLowerCase();
    this.coopname = databaseData.coopname;
    this.project_hash = databaseData.project_hash.toLowerCase();
    this.target_value = databaseData.target_value;
    this.deadline = databaseData.deadline ?? null;
    this.created_by = databaseData.created_by;
    this.status = databaseData.status ?? MetricStatus.ACTIVE;
  }

  archive(): void {
    this.status = MetricStatus.ARCHIVED;
  }
}
