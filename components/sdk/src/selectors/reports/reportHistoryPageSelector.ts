import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawGeneratedReportSummarySelector } from './generatedReportSummarySelector'

export const rawReportHistoryPageSelector = {
  items: rawGeneratedReportSummarySelector,
  total: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['ReportHistoryPage']> = rawReportHistoryPageSelector

export type reportHistoryPageModel = ModelTypes['ReportHistoryPage']
export const reportHistoryPageSelector = Selector('ReportHistoryPage')(rawReportHistoryPageSelector)
