import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawWaveSwingSelector = {
  index: true,
  value: true,
  label: true,
}

const rawFibLevelSelector = {
  ratio: true,
  value: true,
}

const rawWaveCorridorSelector = {
  periods_ahead: true,
  optimistic: true,
  base: true,
  pessimistic: true,
  eta_optimistic_periods: true,
  eta_base_periods: true,
  eta_pessimistic_periods: true,
}

const rawMetricWaveSelector = {
  metric_hash: true,
  title: true,
  unit: true,
  target_value: true,
  fact: true,
  series_mode: true,
  values: true,
  current_label: true,
  current_phase: true,
  swings: rawWaveSwingSelector,
  point_labels: true,
  fib_levels: rawFibLevelSelector,
  corridor: rawWaveCorridorSelector,
  disclaimer: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CapitalMetricWave']> = rawMetricWaveSelector

export type metricWaveModel = ModelTypes['CapitalMetricWave']
export const metricWaveSelector = Selector('CapitalMetricWave')(rawMetricWaveSelector)
export { rawMetricWaveSelector }
