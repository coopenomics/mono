import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawMetricSuperpositionItemSelector = {
  project_hash: true,
  project_title: true,
  metric_hash: true,
  title: true,
  unit: true,
  fact: true,
  target_value: true,
  series_mode: true,
  current_label: true,
  current_phase: true,
  recent_velocity: true,
  drive: true,
}

const rawMetricComponentRollupSelector = {
  project_hash: true,
  project_title: true,
  metrics_count: true,
  fact_sum: true,
  target_sum: true,
}

const rawMetricSuperpositionSelector = {
  project_hash: true,
  period: true,
  fact_sum: true,
  target_sum: true,
  up_count: true,
  down_count: true,
  flat_count: true,
  items: rawMetricSuperpositionItemSelector,
  components: rawMetricComponentRollupSelector,
  disclaimer: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CapitalMetricSuperposition']> =
  rawMetricSuperpositionSelector

export type metricSuperpositionModel = ModelTypes['CapitalMetricSuperposition']
export const metricSuperpositionSelector = Selector('CapitalMetricSuperposition')(
  rawMetricSuperpositionSelector
)
export { rawMetricSuperpositionSelector }
