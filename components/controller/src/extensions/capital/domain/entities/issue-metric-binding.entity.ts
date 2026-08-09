import type { IIssueMetricBindingDatabaseData } from '../interfaces/issue-metric-binding-database.interface';
import { BaseDomainEntity } from '@coopenomics/extension-kit/sync';

export class IssueMetricBindingDomainEntity extends BaseDomainEntity<IIssueMetricBindingDatabaseData> {
  public issue_hash: string;
  public metric_hash: string;
  public delta: number;

  constructor(databaseData: IIssueMetricBindingDatabaseData) {
    super(databaseData, 'active');

    this.issue_hash = databaseData.issue_hash.toLowerCase();
    this.metric_hash = databaseData.metric_hash.toLowerCase();
    this.delta = databaseData.delta;
  }
}
