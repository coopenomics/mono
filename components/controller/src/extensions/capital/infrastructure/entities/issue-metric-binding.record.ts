import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const IssueMetricBindingEntityName = 'capital_issue_metric_bindings';

export class IssueMetricBindingRecord extends ChainRecord {
  issue_hash!: string;

  metric_hash!: string;

  delta!: number;
}
