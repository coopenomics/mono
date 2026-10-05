import { MetricContributionSource } from '../../domain/enums/metric-contribution-source.enum';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const MetricContributionEntityName = 'capital_metric_contributions';

export class MetricContributionRecord extends ChainRecord {
  contribution_hash!: string;

  metric_hash!: string;

  issue_hash?: string | null;

  delta!: number;

  source!: MetricContributionSource;

  username!: string;

  occurred_at!: Date;
}
