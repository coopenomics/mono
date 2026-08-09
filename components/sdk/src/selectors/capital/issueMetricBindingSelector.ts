import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { baseCapitalSelector } from './baseCapitalSelector'

const rawIssueMetricBindingSelector = {
  ...baseCapitalSelector,
  issue_hash: true,
  metric_hash: true,
  delta: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CapitalIssueMetricBinding']> = rawIssueMetricBindingSelector

export type issueMetricBindingModel = ModelTypes['CapitalIssueMetricBinding']
export const issueMetricBindingSelector = Selector('CapitalIssueMetricBinding')(rawIssueMetricBindingSelector)
export { rawIssueMetricBindingSelector }
