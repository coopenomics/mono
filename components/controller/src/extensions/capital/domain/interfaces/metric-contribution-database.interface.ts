import type { MetricContributionSource } from '../enums/metric-contribution-source.enum';
import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Запись журнала вкладов в метрику
 */
export interface IMetricContributionDatabaseData extends IBaseDatabaseData {
  contribution_hash: string;
  metric_hash: string;
  issue_hash?: string | null;
  delta: number;
  source: MetricContributionSource;
  username: string;
  occurred_at: Date;
}
