import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawGeneratedReportSummarySelector = {
  id: true,
  reportType: true,
  year: true,
  period: true,
  fileName: true,
  isValid: true,
  generatedBy: true,
  createdAt: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['GeneratedReportSummary']> = rawGeneratedReportSummarySelector

export type generatedReportSummaryModel = ModelTypes['GeneratedReportSummary']
export const generatedReportSummarySelector = Selector('GeneratedReportSummary')(rawGeneratedReportSummarySelector)
