import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { baseCapitalSelector } from './baseCapitalSelector'

const rawMetricContributionSelector = {
  ...baseCapitalSelector,
  contribution_hash: true,
  metric_hash: true,
  issue_hash: true,
  delta: true,
  source: true,
  username: true,
  occurred_at: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CapitalMetricContribution']> = rawMetricContributionSelector

export type metricContributionModel = ModelTypes['CapitalMetricContribution']
export const metricContributionSelector = Selector('CapitalMetricContribution')(rawMetricContributionSelector)
export { rawMetricContributionSelector }
