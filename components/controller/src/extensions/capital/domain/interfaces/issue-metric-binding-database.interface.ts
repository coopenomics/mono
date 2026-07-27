import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Привязка задачи к метрике (плановый delta-вклад)
 */
export interface IIssueMetricBindingDatabaseData extends IBaseDatabaseData {
  issue_hash: string;
  metric_hash: string;
  delta: number;
}
