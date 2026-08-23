import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawMetricSeriesPointSelector = {
  period_start: true,
  period_end: true,
  delta: true,
  cumulative: true,
  ideal_cumulative: true,
}

const rawMetricSeriesSelector = {
  metric_hash: true,
  title: true,
  unit: true,
  target_value: true,
  series_mode: true,
  fact: true,
  points: rawMetricSeriesPointSelector,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CapitalMetricSeries']> = rawMetricSeriesSelector

export type metricSeriesModel = ModelTypes['CapitalMetricSeries']
export const metricSeriesSelector = Selector('CapitalMetricSeries')(rawMetricSeriesSelector)
export { rawMetricSeriesSelector, rawMetricSeriesPointSelector }
