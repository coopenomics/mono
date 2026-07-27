import type { MetricSeriesMode } from '../enums/metric-series-mode.enum';
import type { MetricStatus } from '../enums/metric-status.enum';
import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Данные метрики компонента из БД
 */
export interface IComponentMetricDatabaseData extends IBaseDatabaseData {
  metric_hash: string;
  coopname: string;
  project_hash: string;
  title: string;
  unit: string;
  target_value: number;
  deadline?: Date | null;
  series_mode: MetricSeriesMode;
  created_by: string;
  status: MetricStatus;
}
