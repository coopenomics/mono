import { registerEnumType } from '@nestjs/graphql';

/**
 * Источник записи в журнале вкладов в метрику
 */
export enum MetricContributionSource {
  ISSUE_DONE = 'issue_done',
  ISSUE_REOPEN = 'issue_reopen',
  MANUAL = 'manual',
}

registerEnumType(MetricContributionSource, {
  name: 'MetricContributionSource',
  description: 'Источник вклада в метрику',
});
