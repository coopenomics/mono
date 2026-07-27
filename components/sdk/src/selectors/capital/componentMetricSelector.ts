import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { baseCapitalSelector } from './baseCapitalSelector'

const rawComponentMetricSelector = {
  ...baseCapitalSelector,
  metric_hash: true,
  coopname: true,
  project_hash: true,
  title: true,
  unit: true,
  target_value: true,
  deadline: true,
  series_mode: true,
  created_by: true,
  status: true,
  fact: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CapitalComponentMetric']> = rawComponentMetricSelector

export type componentMetricModel = ModelTypes['CapitalComponentMetric']
export const componentMetricSelector = Selector('CapitalComponentMetric')(rawComponentMetricSelector)
export { rawComponentMetricSelector }
