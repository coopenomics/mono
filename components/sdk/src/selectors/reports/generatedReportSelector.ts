import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawGeneratedReportSelector = {
  id: true,
  reportType: true,
  year: true,
  period: true,
  xml: true,
  fileName: true,
  errors: true,
  isValid: true,
  createdAt: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['GeneratedReport']> = rawGeneratedReportSelector

export type generatedReportModel = ModelTypes['GeneratedReport']
export const generatedReportSelector = Selector('GeneratedReport')(rawGeneratedReportSelector)
