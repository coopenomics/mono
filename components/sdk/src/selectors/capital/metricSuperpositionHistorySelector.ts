import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawMetricSuperpositionItemSelector } from './metricSuperpositionSelector'

const rawMetricSuperpositionFrameSelector = {
  at: true,
  activity: true,
  coherence: true,
  balance: true,
  growth: true,
  resultant_re: true,
  resultant_im: true,
  resultant_magnitude: true,
  resultant_angle: true,
  fact_sum: true,
  target_sum: true,
  up_count: true,
  down_count: true,
  flat_count: true,
  items: rawMetricSuperpositionItemSelector,
}

const rawMetricSuperpositionHistorySelector = {
  project_hash: true,
  from: true,
  to: true,
  frames: rawMetricSuperpositionFrameSelector,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CapitalMetricSuperpositionHistory']> =
  rawMetricSuperpositionHistorySelector

export type metricSuperpositionHistoryModel = ModelTypes['CapitalMetricSuperpositionHistory']
export const metricSuperpositionHistorySelector = Selector('CapitalMetricSuperpositionHistory')(
  rawMetricSuperpositionHistorySelector
)
export { rawMetricSuperpositionHistorySelector }
