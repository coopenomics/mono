import type { MetricStatus } from '../enums/metric-status.enum';
import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Цель по мере на компоненте (инстанс): мера + target на project_hash.
 */
export interface IComponentMetricDatabaseData extends IBaseDatabaseData {
  metric_hash: string;
  measure_hash: string;
  coopname: string;
  project_hash: string;
  target_value: number;
  deadline?: Date | null;
  created_by: string;
  status: MetricStatus;
}
