import { MetricContributionSource } from '../enums/metric-contribution-source.enum';
import type { IMetricContributionDatabaseData } from '../interfaces/metric-contribution-database.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

export class MetricContributionDomainEntity extends BaseDomainEntity<IMetricContributionDatabaseData> {
  public contribution_hash: string;
  public metric_hash: string;
  public issue_hash?: string | null;
  public delta: number;
  public source: MetricContributionSource;
  public username: string;
  public occurred_at: Date;

  constructor(databaseData: IMetricContributionDatabaseData) {
    super(databaseData, 'active');

    this.contribution_hash = databaseData.contribution_hash.toLowerCase();
    this.metric_hash = databaseData.metric_hash.toLowerCase();
    this.issue_hash =
      databaseData.issue_hash && databaseData.issue_hash.trim() !== ''
        ? databaseData.issue_hash.toLowerCase()
        : null;
    this.delta = databaseData.delta;
    this.source = databaseData.source;
    this.username = databaseData.username;
    this.occurred_at = databaseData.occurred_at
      ? new Date(databaseData.occurred_at)
      : new Date();
  }
}
