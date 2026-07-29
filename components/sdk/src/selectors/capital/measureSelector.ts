import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { baseCapitalSelector } from './baseCapitalSelector'

const rawMeasureSelector = {
  ...baseCapitalSelector,
  measure_hash: true,
  coopname: true,
  title: true,
  unit: true,
  series_mode: true,
  wave_period: true,
  tag: true,
  created_by: true,
  status: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CapitalMeasure']> = rawMeasureSelector

export type measureModel = ModelTypes['CapitalMeasure']
export const measureSelector = Selector('CapitalMeasure')(rawMeasureSelector)
export { rawMeasureSelector }
