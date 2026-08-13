import type { MetricSeriesMode } from '../enums/metric-series-mode.enum';
import type { MetricStatus } from '../enums/metric-status.enum';
import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Мера кооператива: что измеряем (без целевого значения).
 */
export interface IMeasureDatabaseData extends IBaseDatabaseData {
  measure_hash: string;
  coopname: string;
  title: string;
  unit: string;
  series_mode: MetricSeriesMode;
  created_by: string;
  status: MetricStatus;
}
