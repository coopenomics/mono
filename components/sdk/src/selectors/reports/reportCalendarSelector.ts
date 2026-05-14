import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawReportCalendarPeriodEntrySelector = {
  periodCode: true,
  reportYear: true,
  label: true,
  dueMonth: true,
  dueDate: true,
  status: true,
}

const _validatePeriod: MakeAllFieldsRequired<ValueTypes['ReportCalendarPeriodEntry']> =
  rawReportCalendarPeriodEntrySelector

export const rawReportCalendarRowSelector = {
  reportType: true,
  shortName: true,
  periodKind: true,
  periods: rawReportCalendarPeriodEntrySelector,
}

const _validateRow: MakeAllFieldsRequired<ValueTypes['ReportCalendarRow']> =
  rawReportCalendarRowSelector

export type reportCalendarRowModel = ModelTypes['ReportCalendarRow']
export const reportCalendarRowSelector = Selector('ReportCalendarRow')(rawReportCalendarRowSelector)
