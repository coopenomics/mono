import { MetricContributionDomainEntity } from '../entities/metric-contribution.entity';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

export interface MetricContributionRepository {
  create(contribution: MetricContributionDomainEntity): Promise<MetricContributionDomainEntity>;
  createMany(contributions: MetricContributionDomainEntity[]): Promise<MetricContributionDomainEntity[]>;
  sumDeltaByMetricHash(metricHash: string): Promise<number>;
  sumDeltaByMetricHashes(metricHashes: string[]): Promise<Map<string, number>>;
  findByMetricHashPaginated(
    metricHash: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<MetricContributionDomainEntity>>;
  /** Все вклады метрики по возрастанию occurred_at (для ряда burn-up / скорости) */
  findChronologicalByMetricHash(metricHash: string): Promise<MetricContributionDomainEntity[]>;
  /** Сумма вкладов issue_done по задаче (для reverse при reopen) */
  sumIssueDoneDeltaByIssueAndMetric(issueHash: string, metricHash: string): Promise<number>;
}

export const METRIC_CONTRIBUTION_REPOSITORY = Symbol('MetricContributionRepository');
