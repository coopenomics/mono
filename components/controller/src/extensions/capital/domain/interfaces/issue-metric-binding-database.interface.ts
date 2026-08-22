import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/**
 * Привязка задачи к метрике (плановый delta-вклад)
 */
export interface IIssueMetricBindingDatabaseData extends IBaseDatabaseData {
  issue_hash: string;
  metric_hash: string;
  delta: number;
}
