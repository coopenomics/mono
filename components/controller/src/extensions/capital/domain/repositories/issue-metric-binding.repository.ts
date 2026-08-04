import { IssueMetricBindingDomainEntity } from '../entities/issue-metric-binding.entity';

export interface IssueMetricBindingRepository {
  findByIssueHash(issueHash: string): Promise<IssueMetricBindingDomainEntity[]>;
  findByMetricHash(metricHash: string): Promise<IssueMetricBindingDomainEntity[]>;
  /** Полная замена привязок задачи */
  replaceForIssue(issueHash: string, bindings: IssueMetricBindingDomainEntity[]): Promise<IssueMetricBindingDomainEntity[]>;
  deleteByIssueHash(issueHash: string): Promise<void>;
}

export const ISSUE_METRIC_BINDING_REPOSITORY = Symbol('IssueMetricBindingRepository');
